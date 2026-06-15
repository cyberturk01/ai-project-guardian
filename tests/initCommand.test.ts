import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { runGuardianCli } from "../src/cli/runGuardian.js";

describe("init command", () => {
  it("bootstraps Guardian files in the current working directory by default", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Guardian init summary/);
      assert.match(stdout.value, /Created: 10/);
      assert.match(stdout.value, /guardian\.config\.json/);
      assert.match(stdout.value, /\.project-brain\/project\.md/);
      assert.match(stdout.value, /\.github\/workflows\/ai-project-guardian\.yml/);

      const config = JSON.parse(await readFile(join(repoPath, "guardian.config.json"), "utf8")) as {
        projectName: string;
        requiredChecks: string[];
      };
      assert.equal(config.projectName, repoName(repoPath));
      assert.deepEqual(config.requiredChecks, ["npm test"]);
      assert.match(await readFile(join(repoPath, ".project-brain", "project.md"), "utf8"), /^# Project/);
      assert.match(
        await readFile(join(repoPath, ".github", "workflows", "ai-project-guardian.yml"), "utf8"),
        /npx --yes ai-project-guardian --repo \./
      );
    });
  });

  it("prints planned changes without writing files in dry-run mode", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--dry-run"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Guardian init dry run/);
      assert.match(stdout.value, /Created: 10/);
      assert.match(stdout.value, /No files written\./);
      await assert.rejects(access(join(repoPath, "guardian.config.json")));
      await assert.rejects(access(join(repoPath, ".project-brain", "project.md")));
      await assert.rejects(access(join(repoPath, ".github", "workflows", "ai-project-guardian.yml")));
    });
  });

  it("skips existing files without overwriting user content", async () => {
    await withTempRepo(async (repoPath) => {
      await mkdir(join(repoPath, ".project-brain"), { recursive: true });
      await writeFile(join(repoPath, "guardian.config.json"), "{\"projectName\":\"User config\"}\n", "utf8");
      await writeFile(join(repoPath, ".project-brain", "project.md"), "# User Project\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Created: 8/);
      assert.match(stdout.value, /Skipped existing: 2/);
      assert.equal(await readFile(join(repoPath, "guardian.config.json"), "utf8"), "{\"projectName\":\"User config\"}\n");
      assert.equal(await readFile(join(repoPath, ".project-brain", "project.md"), "utf8"), "# User Project\n");
      assert.match(await readFile(join(repoPath, ".project-brain", "architecture.md"), "utf8"), /^# Architecture/);
    });
  });

  it("overwrites existing generated targets when --force is set", async () => {
    await withTempRepo(async (repoPath) => {
      await mkdir(join(repoPath, ".github", "workflows"), { recursive: true });
      await writeFile(join(repoPath, "guardian.config.json"), "{\"projectName\":\"Old config\"}\n", "utf8");
      await writeFile(join(repoPath, ".github", "workflows", "ai-project-guardian.yml"), "name: Old\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--force"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Created: 8/);
      assert.match(stdout.value, /Overwritten: 2/);
      assert.match(await readFile(join(repoPath, "guardian.config.json"), "utf8"), /"projectName":/);
      assert.doesNotMatch(await readFile(join(repoPath, "guardian.config.json"), "utf8"), /Old config/);
      assert.match(
        await readFile(join(repoPath, ".github", "workflows", "ai-project-guardian.yml"), "utf8"),
        /^name: AI Project Guardian/
      );
    });
  });
});

async function withTempRepo(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-init-"));

  try {
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

function repoName(repoPath: string): string {
  return repoPath.split("/").at(-1) ?? repoPath;
}

class MemoryWritable extends Writable {
  value = "";

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.value += chunk.toString();
    callback();
  }
}
