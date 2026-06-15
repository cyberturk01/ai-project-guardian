import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGitCommand } from "../src/repo/gitRunner.js";

describe("runGitCommand", () => {
  it("preserves PATH when executing git", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "guardian-git-path-"));
    const gitPath = join(binDir, "git");
    const previousPath = process.env.PATH;
    const previousGitBin = process.env.AI_PROJECT_GUARDIAN_GIT_BIN;

    await writeExecutable(
      gitPath,
      [
        "#!/bin/sh",
        "case \"$1\" in",
        "  diff) printf 'M\\tREADME.md\\n' ;;",
        "  *) exit 2 ;;",
        "esac"
      ].join("\n")
    );

    try {
      delete process.env.AI_PROJECT_GUARDIAN_GIT_BIN;
      process.env.PATH = [binDir, previousPath].filter(Boolean).join(":");

      const result = await runGitCommand({
        command: "git",
        args: ["diff", "--name-status", "origin/main...HEAD", "--"],
        cwd: binDir
      });

      assert.equal(result.stdout, "M\tREADME.md\n");
    } finally {
      restoreEnv("PATH", previousPath);
      restoreEnv("AI_PROJECT_GUARDIAN_GIT_BIN", previousGitBin);
    }
  });

  it("uses AI_PROJECT_GUARDIAN_GIT_BIN when provided", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "guardian-git-bin-"));
    const customGitPath = join(binDir, "custom-git");
    const markerPath = join(binDir, "marker.txt");
    const previousGitBin = process.env.AI_PROJECT_GUARDIAN_GIT_BIN;

    await writeExecutable(
      customGitPath,
      [
        "#!/bin/sh",
        `printf 'used' > "${markerPath}"`,
        "printf 'A\\tsrc/app.ts\\n'"
      ].join("\n")
    );

    try {
      process.env.AI_PROJECT_GUARDIAN_GIT_BIN = customGitPath;

      const result = await runGitCommand({
        command: "git",
        args: ["diff", "--name-status", "origin/main...HEAD", "--"],
        cwd: binDir
      });

      assert.equal(result.stdout, "A\tsrc/app.ts\n");
      assert.equal(await readFile(markerPath, "utf8"), "used");
    } finally {
      restoreEnv("AI_PROJECT_GUARDIAN_GIT_BIN", previousGitBin);
    }
  });

  it("explains how to recover when git cannot be found", async () => {
    const previousGitBin = process.env.AI_PROJECT_GUARDIAN_GIT_BIN;

    try {
      process.env.AI_PROJECT_GUARDIAN_GIT_BIN = "/not/a/git";

      await assert.rejects(
        () =>
          runGitCommand({
            command: "git",
            args: ["diff", "--name-status", "origin/main...HEAD", "--"],
            cwd: process.cwd()
          }),
        /Git executable not found from Node process\.\nChecked command: \/not\/a\/git\nPATH: .+\nTry setting AI_PROJECT_GUARDIAN_GIT_BIN=\/usr\/bin\/git/
      );
    } finally {
      restoreEnv("AI_PROJECT_GUARDIAN_GIT_BIN", previousGitBin);
    }
  });
});

async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, `${content}\n`, "utf8");
  await chmod(path, 0o755);
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
