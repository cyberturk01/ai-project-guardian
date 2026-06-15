import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveGitBinary, runGitCommand } from "../src/repo/gitRunner.js";

describe("runGitCommand", () => {
  it("falls back to git when AI_PROJECT_GUARDIAN_GIT_BIN is not set", async () => {
    const previousGitBin = process.env.AI_PROJECT_GUARDIAN_GIT_BIN;

    try {
      delete process.env.AI_PROJECT_GUARDIAN_GIT_BIN;
      assert.equal(resolveGitBinary(), "git");

      process.env.AI_PROJECT_GUARDIAN_GIT_BIN = "   ";
      assert.equal(resolveGitBinary(), "git");
    } finally {
      restoreEnv("AI_PROJECT_GUARDIAN_GIT_BIN", previousGitBin);
    }
  });

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
        "  --version) printf 'git version test\\n' ;;",
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
        "case \"$1\" in",
        `  --version) printf 'version' > "${markerPath}"; printf 'git version custom\\n' ;;`,
        `  diff) printf ' used' >> "${markerPath}"; printf 'A\\tsrc/app.ts\\n' ;;`,
        "  *) exit 2 ;;",
        "esac"
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
      assert.equal(await readFile(markerPath, "utf8"), "version used");
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

  it("reports git-validation-failed when the git executable exits non-zero during validation", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "guardian-git-validation-"));
    const customGitPath = join(binDir, "custom-git");
    const previousGitBin = process.env.AI_PROJECT_GUARDIAN_GIT_BIN;

    await writeExecutable(
      customGitPath,
      [
        "#!/bin/sh",
        "printf 'validation stdout\\n'",
        "printf 'validation stderr\\n' >&2",
        "exit 7"
      ].join("\n")
    );

    try {
      process.env.AI_PROJECT_GUARDIAN_GIT_BIN = customGitPath;

      await assert.rejects(
        () =>
          runGitCommand({
            command: "git",
            args: ["diff", "--name-status", "origin/main...HEAD", "--"],
            cwd: binDir
          }),
        (error) => {
          assert(error instanceof Error);
          assert.match(error.message, /git-validation-failed/);
          assert.match(error.message, new RegExp(`Command: ${escapeRegExp(customGitPath)} --version`));
          assert.match(error.message, /Status: 7/);
          assert.match(error.message, /Signal: /);
          assert.match(error.message, /Stdout: validation stdout/);
          assert.match(error.message, /Stderr: validation stderr/);
          assert.doesNotMatch(error.message, /Git executable not found from Node process/);
          return true;
        }
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
