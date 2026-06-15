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
      assert.match(stdout.value, /Preset: generic/);
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

  it("generates the generic config when --preset generic is set", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--preset", "generic"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Preset: generic/);
      assert.deepEqual(config.riskFolders, ["src"]);
      assert.deepEqual(config.testFolders, ["tests"]);
    });
  });

  it("generates the node API config when --preset node-api is set", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--preset", "node-api"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Preset: node-api/);
      assert.deepEqual(config.riskFolders, ["src/routes", "src/services", "src/controllers", "src/middleware", "src/auth", "src/config"]);
      assert.deepEqual(config.testFolders, ["tests", "__tests__"]);
    });
  });

  it("generates the web app config when --preset web-app is set", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--preset", "web-app"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Preset: web-app/);
      assert.deepEqual(config.riskFolders, ["src", "app", "pages", "components"]);
      assert.deepEqual(config.testFolders, ["tests", "__tests__", "cypress", "e2e"]);
    });
  });

  it("generates the Python config when --preset python is set", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--preset", "python"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Preset: python/);
      assert.deepEqual(config.riskFolders, ["src", "app", "api"]);
      assert.deepEqual(config.testFolders, ["tests"]);
      assert.deepEqual(config.releaseSensitiveFiles, ["pyproject.toml", "requirements.txt", "setup.py", "Dockerfile", ".github/workflows"]);
      assert.deepEqual(config.requiredChecks, ["pytest"]);
    });
  });

  it("generates the monorepo config when --preset monorepo is set", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--preset", "monorepo"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.match(stdout.value, /Preset: monorepo/);
      assert.deepEqual(config.riskFolders, ["packages", "apps", "libs", "src"]);
      assert.deepEqual(config.testFolders, ["tests", "__tests__", "packages", "apps", "libs"]);
      assert.deepEqual(config.releaseSensitiveFiles, [
        "package.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "package-lock.json",
        "turbo.json",
        "nx.json",
        ".github/workflows"
      ]);
      assert.deepEqual(config.requiredChecks, ["npm test", "npm run lint"]);
    });
  });

  it("auto-detects python from pyproject.toml", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "pyproject.toml"), "[project]\nname = \"python-fixture\"\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "python");
      assert.match(stdout.value, /Preset: python/);
      assert.deepEqual(config.requiredChecks, ["pytest"]);
    });
  });

  it("auto-detects python from requirements.txt", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "requirements.txt"), "pytest\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "python");
      assert.match(stdout.value, /Preset: python/);
    });
  });

  it("auto-detects monorepo from pnpm-workspace.yaml", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "monorepo");
      assert.match(stdout.value, /Preset: monorepo/);
      assert.deepEqual(config.requiredChecks, ["npm test", "npm run lint"]);
    });
  });

  it("auto-detects monorepo from packages/", async () => {
    await withTempRepo(async (repoPath) => {
      await mkdir(join(repoPath, "packages"), { recursive: true });
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "monorepo");
      assert.match(stdout.value, /Preset: monorepo/);
    });
  });

  it("auto-detects node-api when package.json and API folders exist", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "api-fixture" }, null, 2), "utf8");
      await mkdir(join(repoPath, "src", "services"), { recursive: true });
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "node-api");
      assert.match(stdout.value, /Preset: node-api/);
      assert.deepEqual(config.riskFolders, ["src/routes", "src/services", "src/controllers", "src/middleware", "src/auth", "src/config"]);
    });
  });

  it("auto-detects web-app when package.json and web app markers exist", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "web-fixture" }, null, 2), "utf8");
      await writeFile(join(repoPath, "vite.config.ts"), "export default {};\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--dry-run"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "web-app");
      assert.match(stdout.value, /Guardian init dry run/);
      assert.match(stdout.value, /Preset: web-app/);
      assert.match(stdout.value, /No files written\./);
      await assert.rejects(access(join(repoPath, "guardian.config.json")));
    });
  });

  it("falls back to generic when no project preset is detected", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init"],
        cwd: repoPath,
        stdout
      });
      const config = await readGuardianConfig(repoPath);

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "generic");
      assert.match(stdout.value, /Preset: generic/);
      assert.deepEqual(config.riskFolders, ["src"]);
    });
  });

  it("reports invalid init presets clearly", async () => {
    await withTempRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      await assert.rejects(
        runGuardianCli({
          argv: ["init", "--preset", "rails"],
          cwd: repoPath,
          stdout
        }),
        /Expected "generic", "node-api", "web-app", "python", or "monorepo"/
      );
    });
  });

  it("prints planned changes and the selected preset without writing files in dry-run mode", async () => {
    await withTempRepo(async (repoPath) => {
      await writeFile(join(repoPath, "pyproject.toml"), "[project]\nname = \"python-fixture\"\n", "utf8");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["init", "--dry-run"],
        cwd: repoPath,
        stdout
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.preset, "python");
      assert.match(stdout.value, /Guardian init dry run/);
      assert.match(stdout.value, /Preset: python/);
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

async function readGuardianConfig(repoPath: string): Promise<{
  riskFolders: string[];
  testFolders: string[];
  releaseSensitiveFiles: string[];
  requiredChecks: string[];
}> {
  return JSON.parse(await readFile(join(repoPath, "guardian.config.json"), "utf8")) as {
    riskFolders: string[];
    testFolders: string[];
    releaseSensitiveFiles: string[];
    requiredChecks: string[];
  };
}
