import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile, ChangedFileStatus } from "../core/types.js";

const execFileAsync = promisify(execFile);
const defaultBaseRef = "origin/main";
const fallbackRef = "HEAD~1";
const allowedBaseRefPattern = /^[A-Za-z0-9._/@~-]+$/;

export type GitCommand = {
  command: "git";
  args: string[];
  cwd: string;
};

export type GitCommandResult = {
  stdout: string;
};

export type GitCommandRunner = (command: GitCommand) => Promise<GitCommandResult>;

export type GetChangedFilesOptions = {
  repoPath: string;
  baseRef?: string;
  runCommand?: GitCommandRunner;
};

export async function getChangedFiles(options: GetChangedFilesOptions): Promise<ChangedFile[]> {
  const runCommand = options.runCommand ?? runGitCommand;

  if (options.baseRef !== undefined) {
    const result = await runCommand(buildDiffCommand(options.repoPath, options.baseRef));
    return parseNameStatus(result.stdout);
  }

  try {
    const result = await runCommand(buildDiffCommand(options.repoPath, defaultBaseRef));
    return parseNameStatus(result.stdout);
  } catch {
    const result = await runCommand(buildFallbackDiffCommand(options.repoPath));
    return parseNameStatus(result.stdout);
  }
}

export function parseNameStatus(output: string): ChangedFile[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map(parseNameStatusLine);
}

function parseNameStatusLine(line: string): ChangedFile {
  const [rawStatus, firstPath, secondPath] = line.split("\t");
  const status = parseStatus(rawStatus);

  if (status === "renamed") {
    return makeChangedFile(secondPath ?? firstPath ?? "", status, firstPath);
  }

  return makeChangedFile(firstPath ?? "", status);
}

function parseStatus(rawStatus: string | undefined): ChangedFileStatus {
  const statusCode = rawStatus?.[0];

  if (statusCode === "A" || statusCode === "C") {
    return "added";
  }

  if (statusCode === "D") {
    return "deleted";
  }

  if (statusCode === "R") {
    return "renamed";
  }

  return "modified";
}

function makeChangedFile(path: string, status: ChangedFileStatus, previousPath?: string): ChangedFile {
  return {
    path,
    previousPath,
    status,
    category: "unknown",
    riskLevel: "info"
  };
}

function buildDiffCommand(repoPath: string, baseRef: string): GitCommand {
  assertSafeBaseRef(baseRef);

  return {
    command: "git",
    args: ["diff", "--name-status", `${baseRef}...HEAD`, "--"],
    cwd: repoPath
  };
}

function buildFallbackDiffCommand(repoPath: string): GitCommand {
  return {
    command: "git",
    args: ["diff", "--name-status", fallbackRef, "--"],
    cwd: repoPath
  };
}

function assertSafeBaseRef(baseRef: string): void {
  if (baseRef.trim() === "" || baseRef.startsWith("-") || !allowedBaseRefPattern.test(baseRef)) {
    throw new Error(`Unsafe git base ref: ${baseRef}`);
  }
}

async function runGitCommand(command: GitCommand): Promise<GitCommandResult> {
  const { stdout } = await execFileAsync(command.command, command.args, {
    cwd: command.cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return { stdout };
}
