import { resolve } from "node:path";
import type { GuardianConfig } from "../core/types.js";
import { loadGuardianConfig } from "./guardianConfig.js";

export type ReportFormat = "markdown" | "json";

export type CliConfig = {
  repoPath: string;
  format: ReportFormat;
  outputPath?: string;
  guardian: GuardianConfig;
  warnings: string[];
};

type ConfigInput = {
  repoPath?: string;
  format?: string;
  outputPath?: string;
};

export function loadConfig(input: ConfigInput): CliConfig {
  const repoPath = resolve(input.repoPath ?? process.env.GUARDIAN_REPO_PATH ?? ".");
  const guardianConfig = loadGuardianConfig(repoPath);

  return {
    repoPath,
    format: parseFormat(input.format ?? process.env.GUARDIAN_REPORT_FORMAT),
    outputPath: resolveOptionalPath(input.outputPath ?? process.env.GUARDIAN_OUTPUT_PATH),
    guardian: guardianConfig.config,
    warnings: guardianConfig.warnings
  };
}

function resolveOptionalPath(path: string | undefined): string | undefined {
  if (path === undefined || path === "") {
    return undefined;
  }

  return resolve(path);
}

function parseFormat(format: string | undefined): ReportFormat {
  if (format === undefined || format === "") {
    return "markdown";
  }

  if (format === "markdown" || format === "json") {
    return format;
  }

  throw new Error(`Unsupported report format: ${format}`);
}
