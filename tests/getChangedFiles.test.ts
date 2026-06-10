import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getChangedFiles, parseNameStatus, type GitCommand } from "../src/repo/getChangedFiles.js";

describe("parseNameStatus", () => {
  it("maps git name-status output to changed files", () => {
    const changedFiles = parseNameStatus(
      [
        "A\tsrc/new.ts",
        "M\tsrc/existing.ts",
        "D\tsrc/removed.ts",
        "R100\tsrc/old.ts\tsrc/new-name.ts"
      ].join("\n")
    );

    assert.deepEqual(changedFiles, [
      {
        path: "src/new.ts",
        previousPath: undefined,
        status: "added",
        category: "unknown",
        riskLevel: "info"
      },
      {
        path: "src/existing.ts",
        previousPath: undefined,
        status: "modified",
        category: "unknown",
        riskLevel: "info"
      },
      {
        path: "src/removed.ts",
        previousPath: undefined,
        status: "deleted",
        category: "unknown",
        riskLevel: "info"
      },
      {
        path: "src/new-name.ts",
        previousPath: "src/old.ts",
        status: "renamed",
        category: "unknown",
        riskLevel: "info"
      }
    ]);
  });
});

describe("getChangedFiles", () => {
  it("uses origin/main...HEAD by default", async () => {
    const commands: GitCommand[] = [];
    const changedFiles = await getChangedFiles({
      repoPath: "/repo",
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "M\tREADME.md\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["diff", "--name-status", "origin/main...HEAD", "--"],
        cwd: "/repo"
      }
    ]);
    assert.equal(changedFiles[0]?.path, "README.md");
    assert.equal(changedFiles[0]?.status, "modified");
  });

  it("falls back to HEAD~1 when origin/main is unavailable", async () => {
    const commands: GitCommand[] = [];
    const changedFiles = await getChangedFiles({
      repoPath: "/repo",
      runCommand: async (command) => {
        commands.push(command);

        if (commands.length === 1) {
          throw new Error("missing origin/main");
        }

        return { stdout: "A\tsrc/file.ts\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["diff", "--name-status", "origin/main...HEAD", "--"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["diff", "--name-status", "HEAD~1", "--"],
        cwd: "/repo"
      }
    ]);
    assert.equal(changedFiles[0]?.status, "added");
  });

  it("uses an explicit base ref from the CLI config", async () => {
    const commands: GitCommand[] = [];

    await getChangedFiles({
      repoPath: "/repo",
      baseRef: "origin/release-1.2",
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["diff", "--name-status", "origin/release-1.2...HEAD", "--"],
        cwd: "/repo"
      }
    ]);
  });

  it("rejects unsafe base refs before command execution", async () => {
    let executed = false;

    await assert.rejects(
      () =>
        getChangedFiles({
          repoPath: "/repo",
          baseRef: "--output=/tmp/owned",
          runCommand: async () => {
            executed = true;
            return { stdout: "" };
          }
        }),
      /Unsafe git base ref/
    );

    assert.equal(executed, false);
  });
});
