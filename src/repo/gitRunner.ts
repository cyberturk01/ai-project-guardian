import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultGitCommand = "git";
const macOsFallbackGitCommand = "/usr/bin/git";
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
  const configuredGitCommand = process.env[gitBinEnvVar]?.trim();
  const firstGitCommand = configuredGitCommand || command.command || defaultGitCommand;

  try {
    return await execGitCommand(firstGitCommand, command);
  } catch (error) {
    if (!isEnoentError(error) || configuredGitCommand !== undefined) {
      throw enhanceGitNotFoundError(error, firstGitCommand);
    }

    try {
      return await execGitCommand(macOsFallbackGitCommand, command);
    } catch (fallbackError) {
      if (isEnoentError(fallbackError)) {
        throw enhanceGitNotFoundError(fallbackError, firstGitCommand);
      }

      throw fallbackError;
    }
  }
}

async function execGitCommand(gitCommand: string, command: GitCommand): Promise<GitCommandResult> {
  const { stdout } = await execFileAsync(gitCommand, command.args, {
    cwd: command.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: process.env.PATH
    },
    windowsHide: true
  });

  return { stdout };
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
