import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getChangedFiles, getChangedFilesWithWarnings, parseNameStatus, type GitCommand } from "../src/repo/getChangedFiles.js";

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
  it("uses a valid explicit base ref from the CLI config", async () => {
    const commands: GitCommand[] = [];
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/release-1.2",
      runCommand: async (command) => {
        commands.push(command);
        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }
        return { stdout: "M\tREADME.md\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "origin/release-1.2^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["diff", "--name-status", "origin/release-1.2...HEAD", "--"],
        cwd: "/repo"
      },
      ...expectedLocalChangedFileCommands("/repo")
    ]);
    assert.equal(result.changedFiles[0]?.path, "README.md");
    assert.equal(result.changedFiles[0]?.status, "modified");
    assert.deepEqual(result.warnings, []);
  });

  it("falls back to HEAD~1 when an explicit base ref is unavailable", async () => {
    const commands: GitCommand[] = [];
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/missing",
      runCommand: async (command) => {
        commands.push(command);

        if (command.args.includes("origin/missing^{commit}")) {
          throw new Error("missing origin/missing");
        }

        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }

        return { stdout: "A\tsrc/file.ts\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "origin/missing^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "HEAD~1^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["diff", "--name-status", "HEAD~1", "--"],
        cwd: "/repo"
      },
      ...expectedLocalChangedFileCommands("/repo")
    ]);
    assert.equal(result.changedFiles[0]?.status, "added");
    assert.deepEqual(result.warnings, ['Requested base ref "origin/missing" could not be used; trying HEAD~1.']);
  });

  it("falls back from missing origin/main to main by default", async () => {
    const commands: GitCommand[] = [];
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      runCommand: async (command) => {
        commands.push(command);

        if (command.args.includes("origin/main^{commit}")) {
          throw new Error("missing origin/main");
        }

        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }

        return { stdout: "M\tsrc/main.ts\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "origin/main^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "main^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["diff", "--name-status", "main...HEAD", "--"],
        cwd: "/repo"
      },
      ...expectedLocalChangedFileCommands("/repo")
    ]);
    assert.equal(result.changedFiles[0]?.path, "src/main.ts");
    assert.deepEqual(result.warnings, ["Default base ref origin/main could not be used; using main."]);
  });

  it("falls back from missing origin/main, main, and master to HEAD~1 by default", async () => {
    const commands: GitCommand[] = [];
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      runCommand: async (command) => {
        commands.push(command);

        if (
          command.args.includes("origin/main^{commit}") ||
          command.args.includes("main^{commit}") ||
          command.args.includes("master^{commit}")
        ) {
          throw new Error("missing named base");
        }

        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }

        return { stdout: "M\tsrc/fallback.ts\n" };
      }
    });

    assert.deepEqual(commands, [
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "origin/main^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "main^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "master^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["rev-parse", "--verify", "--quiet", "HEAD~1^{commit}"],
        cwd: "/repo"
      },
      {
        command: "git",
        args: ["diff", "--name-status", "HEAD~1", "--"],
        cwd: "/repo"
      },
      ...expectedLocalChangedFileCommands("/repo")
    ]);
    assert.equal(result.changedFiles[0]?.path, "src/fallback.ts");
    assert.deepEqual(result.warnings, ["Default base ref origin/main could not be used; using HEAD~1."]);
  });

  it("returns no changed files when a repository has no previous commit", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      runCommand: async (command) => {
        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }

        throw new Error("missing ref");
      }
    });

    assert.deepEqual(result.changedFiles, []);
    assert.deepEqual(result.warnings, [
      "No valid git base ref found (tried origin/main, main, master, HEAD~1); continuing with local working tree changes only."
    ]);
  });

  it("converts git diff errors into warnings and tries the next fallback", async () => {
    const commands: GitCommand[] = [];
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      runCommand: async (command) => {
        commands.push(command);

        if (command.args.includes("origin/main...HEAD")) {
          throw new Error("fatal: bad revision 'origin/main...HEAD'");
        }

        if (command.args.includes("main^{commit}") || command.args.includes("master^{commit}")) {
          throw new Error("missing branch");
        }

        if (isLocalChangedFileCommand(command)) {
          return { stdout: "" };
        }

        return { stdout: "M\tsrc/recovered.ts\n" };
      }
    });

    assert.deepEqual(
      commands.map((command) => command.args),
      [
        ["rev-parse", "--verify", "--quiet", "origin/main^{commit}"],
        ["diff", "--name-status", "origin/main...HEAD", "--"],
        ["rev-parse", "--verify", "--quiet", "main^{commit}"],
        ["rev-parse", "--verify", "--quiet", "master^{commit}"],
        ["rev-parse", "--verify", "--quiet", "HEAD~1^{commit}"],
        ["diff", "--name-status", "HEAD~1", "--"],
        ["diff", "--name-status", "--cached", "--"],
        ["diff", "--name-status", "--"],
        ["ls-files", "--others", "--exclude-standard"]
      ]
    );
    assert.equal(result.changedFiles[0]?.path, "src/recovered.ts");
    assert.match(result.warnings[0] ?? "", /git diff failed: fatal: bad revision/);
    assert.equal(result.warnings[1], "Default base ref origin/main could not be used; using HEAD~1.");
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

  it("counts unstaged modified files", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: "",
        unstagedDiff: "M\tsrc/unstaged.ts\n"
      })
    });

    assert.deepEqual(
      result.changedFiles.map(({ path, status }) => ({ path, status })),
      [{ path: "src/unstaged.ts", status: "modified" }]
    );
    assert.ok(result.warnings.includes("Local working tree changes were included in changed-file detection."));
  });

  it("counts staged modified files", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: "",
        cachedDiff: "M\tsrc/staged.ts\n"
      })
    });

    assert.deepEqual(
      result.changedFiles.map(({ path, status }) => ({ path, status })),
      [{ path: "src/staged.ts", status: "modified" }]
    );
    assert.ok(result.warnings.includes("Local working tree changes were included in changed-file detection."));
  });

  it("counts untracked files as added", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: "",
        untrackedFiles: "src/new-local.ts\n"
      })
    });

    assert.deepEqual(
      result.changedFiles.map(({ path, status }) => ({ path, status })),
      [{ path: "src/new-local.ts", status: "added" }]
    );
    assert.ok(result.warnings.includes("Local working tree changes were included in changed-file detection."));
  });

  it("keeps committed branch diff changes", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: "M\tsrc/branch.ts\n"
      })
    });

    assert.deepEqual(
      result.changedFiles.map(({ path, status }) => ({ path, status })),
      [{ path: "src/branch.ts", status: "modified" }]
    );
    assert.deepEqual(result.warnings, []);
  });

  it("deduplicates branch and unstaged changes by path with deterministic status priority", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: "A\tsrc/duplicate.ts\n",
        unstagedDiff: "M\tsrc/duplicate.ts\n"
      })
    });

    assert.deepEqual(
      result.changedFiles.map(({ path, status }) => ({ path, status })),
      [{ path: "src/duplicate.ts", status: "modified" }]
    );
    assert.ok(result.warnings.includes("Local working tree changes were included in changed-file detection."));
  });

  it("reports no changed files for a clean repository", async () => {
    const result = await getChangedFilesWithWarnings({
      repoPath: "/repo",
      baseRef: "origin/main",
      runCommand: createChangedFileRunner({
        baseDiff: ""
      })
    });

    assert.deepEqual(result.changedFiles, []);
    assert.deepEqual(result.warnings, []);
  });
});

function createChangedFileRunner(outputs: {
  baseDiff: string;
  cachedDiff?: string;
  unstagedDiff?: string;
  untrackedFiles?: string;
}) {
  return async (command: GitCommand) => {
    if (command.args[0] === "rev-parse") {
      return { stdout: "commit-sha\n" };
    }

    if (command.args.join(" ") === "diff --name-status --cached --") {
      return { stdout: outputs.cachedDiff ?? "" };
    }

    if (command.args.join(" ") === "diff --name-status --") {
      return { stdout: outputs.unstagedDiff ?? "" };
    }

    if (command.args.join(" ") === "ls-files --others --exclude-standard") {
      return { stdout: outputs.untrackedFiles ?? "" };
    }

    return { stdout: outputs.baseDiff };
  };
}

function isLocalChangedFileCommand(command: GitCommand): boolean {
  const args = command.args.join(" ");

  return args === "diff --name-status --cached --" || args === "diff --name-status --" || args === "ls-files --others --exclude-standard";
}

function expectedLocalChangedFileCommands(repoPath: string): GitCommand[] {
  return [
    {
      command: "git",
      args: ["diff", "--name-status", "--cached", "--"],
      cwd: repoPath
    },
    {
      command: "git",
      args: ["diff", "--name-status", "--"],
      cwd: repoPath
    },
    {
      command: "git",
      args: ["ls-files", "--others", "--exclude-standard"],
      cwd: repoPath
    }
  ];
}
