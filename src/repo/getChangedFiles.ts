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

const localWorkingTreeIncludedWarning = "Local working tree changes were included in changed-file detection.";

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
      return withLocalWorkingTreeChanges({
        repoPath: options.repoPath,
        baseChangedFiles: explicitResult,
        runCommand,
        warnings
      });
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
      return withLocalWorkingTreeChanges({
        repoPath: options.repoPath,
        baseChangedFiles: fallbackResult,
        runCommand,
        warnings
      });
    }

    warnings.push(`Fallback base ref HEAD~1 could not be used; continuing with local working tree changes only.`);
    return withLocalWorkingTreeChanges({
      repoPath: options.repoPath,
      baseChangedFiles: [],
      runCommand,
      warnings
    });
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

      return withLocalWorkingTreeChanges({
        repoPath: options.repoPath,
        baseChangedFiles: result,
        runCommand,
        warnings
      });
    }
  }

  warnings.push(`No valid git base ref found (tried ${defaultBaseRefCandidates.join(", ")}); continuing with local working tree changes only.`);
  return withLocalWorkingTreeChanges({
    repoPath: options.repoPath,
    baseChangedFiles: [],
    runCommand,
    warnings
  });
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

function buildCachedDiffCommand(repoPath: string): GitCommand {
  return {
    command: "git",
    args: ["diff", "--name-status", "--cached", "--"],
    cwd: repoPath
  };
}

function buildWorkingTreeDiffCommand(repoPath: string): GitCommand {
  return {
    command: "git",
    args: ["diff", "--name-status", "--"],
    cwd: repoPath
  };
}

function buildUntrackedFilesCommand(repoPath: string): GitCommand {
  return {
    command: "git",
    args: ["ls-files", "--others", "--exclude-standard"],
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

async function withLocalWorkingTreeChanges(options: {
  repoPath: string;
  baseChangedFiles: ChangedFile[];
  runCommand: GitCommandRunner;
  warnings: string[];
}): Promise<GetChangedFilesResult> {
  const localChangedFiles = await getLocalWorkingTreeChangedFiles(options.repoPath, options.runCommand, options.warnings);
  const changedFiles = dedupeChangedFiles([...options.baseChangedFiles, ...localChangedFiles]);

  if (localChangedFiles.length > 0) {
    options.warnings.push(localWorkingTreeIncludedWarning);
  }

  return { changedFiles, warnings: options.warnings };
}

async function getLocalWorkingTreeChangedFiles(
  repoPath: string,
  runCommand: GitCommandRunner,
  warnings: string[]
): Promise<ChangedFile[]> {
  try {
    const [cachedResult, workingTreeResult, untrackedResult] = await Promise.all([
      runCommand(buildCachedDiffCommand(repoPath)),
      runCommand(buildWorkingTreeDiffCommand(repoPath)),
      runCommand(buildUntrackedFilesCommand(repoPath))
    ]);

    return [
      ...parseNameStatus(cachedResult.stdout),
      ...parseNameStatus(workingTreeResult.stdout),
      ...parseUntrackedFiles(untrackedResult.stdout)
    ];
  } catch (error) {
    warnings.push(`Local working tree changes could not be inspected: ${formatGitError(error)}`);
    return [];
  }
}

function parseUntrackedFiles(output: string): ChangedFile[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((path) => makeChangedFile(path, "added"));
}

function dedupeChangedFiles(changedFiles: ChangedFile[]): ChangedFile[] {
  const deduped = new Map<string, ChangedFile>();

  for (const file of changedFiles) {
    const existing = deduped.get(file.path);

    if (existing === undefined || statusPriority(file.status) > statusPriority(existing.status)) {
      deduped.set(file.path, file);
    }
  }

  return [...deduped.values()];
}

function statusPriority(status: ChangedFileStatus): number {
  if (status === "deleted") {
    return 4;
  }

  if (status === "renamed") {
    return 3;
  }

  if (status === "modified") {
    return 2;
  }

  return 1;
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
