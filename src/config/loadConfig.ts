import { resolve } from "node:path";
import type { GuardianConfig } from "../core/types.js";

export type ReportFormat = "markdown" | "json";

export type CliConfig = {
  repoPath: string;
  format: ReportFormat;
  outputPath?: string;
  guardian: GuardianConfig;
};

type ConfigInput = {
  repoPath?: string;
  format?: string;
  outputPath?: string;
};

export function loadConfig(input: ConfigInput): CliConfig {
  return {
    repoPath: resolve(input.repoPath ?? process.env.GUARDIAN_REPO_PATH ?? "."),
    format: parseFormat(input.format ?? process.env.GUARDIAN_REPORT_FORMAT),
    outputPath: input.outputPath ?? process.env.GUARDIAN_OUTPUT_PATH,
    guardian: {
      projectName: process.env.GUARDIAN_PROJECT_NAME ?? "ai-project-guardian",
      riskFolders: [],
      testFolders: [],
      releaseSensitiveFiles: [],
      requiredChecks: []
    }
  };
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
