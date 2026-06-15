import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile, ChangedFileStatus } from "../core/types.js";

const execFileAsync = promisify(execFile);
const defaultBaseRef = "origin/main";
const defaultBaseRefCandidates = ["origin/main", "main", "master", "HEAD~1"] as const;
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

export type GetChangedFilesResult = {
  changedFiles: ChangedFile[];
  warnings: string[];
};

export async function getChangedFiles(options: GetChangedFilesOptions): Promise<ChangedFile[]> {
  const result = await getChangedFilesWithWarnings(options);

  return result.changedFiles;
}

export async function getChangedFilesWithWarnings(options: GetChangedFilesOptions): Promise<GetChangedFilesResult> {
  const runCommand = options.runCommand ?? runGitCommand;
  const warnings: string[] = [];

  if (options.baseRef !== undefined) {
    const explicitResult = await tryChangedFilesFromBaseRef({
      repoPath: options.repoPath,
      baseRef: options.baseRef,
      runCommand,
      warnings,
      warningPrefix: `Requested base ref "${options.baseRef}"`
    });

    if (explicitResult !== undefined) {
      return { changedFiles: explicitResult, warnings };
    }

    warnings.push(`Requested base ref "${options.baseRef}" could not be used; trying HEAD~1.`);
    const fallbackResult = await tryChangedFilesFromBaseRef({
      repoPath: options.repoPath,
      baseRef: fallbackRef,
      runCommand,
      warnings,
      warningPrefix: "Fallback base ref HEAD~1",
      diffMode: "direct"
    });

    if (fallbackResult !== undefined) {
      return { changedFiles: fallbackResult, warnings };
    }

    warnings.push(`Fallback base ref HEAD~1 could not be used; continuing with no changed files.`);
    return { changedFiles: [], warnings };
  }

  for (const baseRef of defaultBaseRefCandidates) {
    const result = await tryChangedFilesFromBaseRef({
      repoPath: options.repoPath,
      baseRef,
      runCommand,
      warnings,
      warningPrefix: `Default base ref ${baseRef}`,
      diffMode: baseRef === fallbackRef ? "direct" : "merge-base"
    });

    if (result !== undefined) {
      if (baseRef !== defaultBaseRef) {
        warnings.push(`Default base ref ${defaultBaseRef} could not be used; using ${baseRef}.`);
      }

      return { changedFiles: result, warnings };
    }
  }

  warnings.push(`No valid git base ref found (tried ${defaultBaseRefCandidates.join(", ")}); continuing with no changed files.`);
  return { changedFiles: [], warnings };
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

function buildVerifyRefCommand(repoPath: string, baseRef: string): GitCommand {
  assertSafeBaseRef(baseRef);

  return {
    command: "git",
    args: ["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`],
    cwd: repoPath
  };
}

async function tryChangedFilesFromBaseRef(options: {
  repoPath: string;
  baseRef: string;
  runCommand: GitCommandRunner;
  warnings: string[];
  warningPrefix: string;
  diffMode?: "merge-base" | "direct";
}): Promise<ChangedFile[] | undefined> {
  assertSafeBaseRef(options.baseRef);

  try {
    await options.runCommand(buildVerifyRefCommand(options.repoPath, options.baseRef));
  } catch {
    return undefined;
  }

  try {
    const command =
      options.diffMode === "direct" ? buildFallbackDiffCommand(options.repoPath) : buildDiffCommand(options.repoPath, options.baseRef);
    const result = await options.runCommand(command);

    return parseNameStatus(result.stdout);
  } catch (error) {
    options.warnings.push(`${options.warningPrefix} exists, but git diff failed: ${formatGitError(error)} Continuing with fallback base detection.`);
    return undefined;
  }
}

function assertSafeBaseRef(baseRef: string): void {
  if (baseRef.trim() === "" || baseRef.startsWith("-") || !allowedBaseRefPattern.test(baseRef)) {
    throw new Error(`Unsafe git base ref: ${baseRef}`);
  }
}

function formatGitError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.trim();
  }

  return String(error);
}

async function runGitCommand(command: GitCommand): Promise<GitCommandResult> {
  const { stdout } = await execFileAsync(command.command, command.args, {
    cwd: command.cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return { stdout };
}
