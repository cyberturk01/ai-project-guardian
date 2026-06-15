import { spawnSync } from "node:child_process";

const defaultGitCommand = "git";
const gitBinEnvVar = "AI_PROJECT_GUARDIAN_GIT_BIN";

export type GitCommand = {
  command: "git";
  args: string[];
  cwd: string;
};

export type GitCommandResult = {
  stdout: string;
};

export type GitCommandRunner = (command: GitCommand) => Promise<GitCommandResult>;

export async function runGitCommand(command: GitCommand): Promise<GitCommandResult> {
  const gitCommand = resolveGitBinary();

  validateGitExecutable(gitCommand);
  return execGitCommand(gitCommand, command);
}

export function resolveGitBinary(): string {
  const configuredGitCommand = process.env[gitBinEnvVar]?.trim();
  return configuredGitCommand || defaultGitCommand;
}

function validateGitExecutable(gitCommand: string): void {
  const result = spawnSync(gitCommand, ["--version"], buildSpawnOptions(process.cwd()));

  if (result.error !== undefined) {
    throw enhanceGitNotFoundError(result.error, gitCommand);
  }

  if (result.status !== 0 || result.signal !== null) {
    throw buildGitProcessError("git-validation-failed", gitCommand, ["--version"], result);
  }
}

function execGitCommand(gitCommand: string, command: GitCommand): GitCommandResult {
  const result = spawnSync(gitCommand, command.args, buildSpawnOptions(command.cwd));

  if (result.error !== undefined) {
    throw enhanceGitNotFoundError(result.error, gitCommand);
  }

  if (result.status !== 0 || result.signal !== null) {
    throw buildGitProcessError("git-command-failed", gitCommand, command.args, result);
  }

  return { stdout: result.stdout };
}

function buildSpawnOptions(cwd: string) {
  return {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH
    },
    windowsHide: true
  } as const;
}

function isEnoentError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function enhanceGitNotFoundError(error: unknown, checkedCommand: string): Error {
  if (!isEnoentError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const message = [
    "Git executable not found from Node process.",
    `Checked command: ${checkedCommand}`,
    `PATH: ${process.env.PATH ?? ""}`,
    `Try setting ${gitBinEnvVar}=/usr/bin/git`
  ].join("\n");

  return new Error(message);
}

function buildGitProcessError(
  reason: "git-validation-failed" | "git-command-failed",
  command: string,
  args: string[],
  result: {
    status: number | null;
    signal: NodeJS.Signals | null;
    stdout: string | Buffer;
    stderr: string | Buffer;
  }
): Error {
  const message = [
    reason,
    `Command: ${[command, ...args].join(" ")}`,
    `Status: ${result.status ?? ""}`,
    `Signal: ${result.signal ?? ""}`,
    `Stdout: ${String(result.stdout)}`,
    `Stderr: ${String(result.stderr)}`
  ].join("\n");

  return new Error(message);
}
