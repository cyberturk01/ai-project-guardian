import { resolve } from "node:path";
import type { GuardianConfig } from "../core/types.js";
import { loadGuardianConfig } from "./guardianConfig.js";

export type ReportFormat = "markdown" | "json" | "sarif";

export type CliConfig = {
  repoPath: string;
  baseRef?: string;
  format: ReportFormat;
  outputPath?: string;
  externalArtifacts: ExternalArtifactConfig;
  guardian: GuardianConfig;
  warnings: string[];
};

export type ExternalArtifactConfig = {
  sarif: string[];
  codeql: string[];
  semgrep: string[];
  snyk: string[];
};

type ConfigInput = {
  repoPath?: string;
  baseRef?: string;
  format?: string;
  outputPath?: string;
  sarifPaths?: string[];
  codeqlPaths?: string[];
  semgrepPaths?: string[];
  snykPaths?: string[];
};

export function loadConfig(input: ConfigInput): CliConfig {
  const repoPath = resolve(input.repoPath ?? process.env.GUARDIAN_REPO_PATH ?? ".");
  const guardianConfig = loadGuardianConfig(repoPath);

  return {
    repoPath,
    baseRef: normalizeOptionalValue(input.baseRef ?? process.env.GUARDIAN_BASE_REF),
    format: parseFormat(input.format ?? process.env.GUARDIAN_REPORT_FORMAT),
    outputPath: resolveOptionalPath(input.outputPath ?? process.env.GUARDIAN_OUTPUT_PATH),
    externalArtifacts: {
      sarif: resolveOptionalPaths(input.sarifPaths, process.env.GUARDIAN_SARIF_PATHS),
      codeql: resolveOptionalPaths(input.codeqlPaths, process.env.GUARDIAN_CODEQL_PATHS),
      semgrep: resolveOptionalPaths(input.semgrepPaths, process.env.GUARDIAN_SEMGREP_PATHS),
      snyk: resolveOptionalPaths(input.snykPaths, process.env.GUARDIAN_SNYK_PATHS)
    },
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

function resolveOptionalPaths(paths: string[] | undefined, envValue: string | undefined): string[] {
  const values = paths !== undefined && paths.length > 0 ? paths : splitEnvPaths(envValue);

  return values.map((path) => resolve(path));
}

function splitEnvPaths(value: string | undefined): string[] {
  const normalized = normalizeOptionalValue(value);

  if (normalized === undefined) {
    return [];
  }

  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
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
