import { resolve } from "node:path";
import type { GuardianConfig } from "../core/types.js";
import { loadGuardianConfig } from "./guardianConfig.js";

export type ReportFormat = "markdown" | "json" | "sarif";

export type CliConfig = {
  repoPath: string;
  baseRef?: string;
  format: ReportFormat;
  outputPath?: string;
  guardian: GuardianConfig;
  warnings: string[];
};

type ConfigInput = {
  repoPath?: string;
  baseRef?: string;
  format?: string;
  outputPath?: string;
};

export function loadConfig(input: ConfigInput): CliConfig {
  const repoPath = resolve(input.repoPath ?? process.env.GUARDIAN_REPO_PATH ?? ".");
  const guardianConfig = loadGuardianConfig(repoPath);

  return {
    repoPath,
    baseRef: normalizeOptionalValue(input.baseRef ?? process.env.GUARDIAN_BASE_REF),
    format: parseFormat(input.format ?? process.env.GUARDIAN_REPORT_FORMAT),
    outputPath: resolveOptionalPath(input.outputPath ?? process.env.GUARDIAN_OUTPUT_PATH),
    guardian: guardianConfig.config,
    warnings: guardianConfig.warnings
  };
}

function resolveOptionalPath(path: string | undefined): string | undefined {
  const normalized = normalizeOptionalValue(path);

  if (normalized === undefined) {
    return undefined;
  }

  return resolve(normalized);
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

function parseFormat(format: string | undefined): ReportFormat {
  if (format === undefined || format === "") {
    return "markdown";
  }

  if (format === "markdown" || format === "json" || format === "sarif") {
    return format;
  }

  throw new Error(`Unsupported report format: ${format}`);
}
