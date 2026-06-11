import { writeFile } from "node:fs/promises";
import { loadConfig, type ReportFormat } from "../config/loadConfig.js";
import type { RiskLevel } from "../core/types.js";
import { runGuardian as runGuardianCore } from "../core/guardian.js";
import { renderReport, type ReportStyle } from "../renderers/renderReport.js";

export type FailOnRisk = Extract<RiskLevel, "high" | "critical">;

export type CliArgs = {
  repo?: string;
  base?: string;
  out?: string;
  format?: ReportFormat;
  sarifPaths: string[];
  codeqlPaths: string[];
  semgrepPaths: string[];
  snykPaths: string[];
  failOn?: FailOnRisk;
  reportStyle: ReportStyle;
  help: boolean;
};

export type CliRunResult = {
  exitCode: number;
  outputPath?: string;
  overallRisk?: RiskLevel;
};

export type CliRunOptions = {
  argv: string[];
  stdout?: NodeJS.WritableStream;
};

export const helpText = `ai-project-guardian

Usage:
  ai-project-guardian --repo <path> [--base <ref>] [--out <path>] [--format markdown|json|sarif] [--sarif <path>] [--codeql <path>] [--semgrep <path>] [--snyk <path>] [--summary-only|--full-report|--pr-comment] [--fail-on high|critical]

Options:
  --repo <path>          Target repository path. Defaults to GUARDIAN_REPO_PATH or ".".
  --base <ref>           Base git ref for changed file detection. Defaults to origin/main with HEAD~1 fallback.
  --out <path>           Output report path. Defaults to GUARDIAN_OUTPUT_PATH when set.
  --format <format>      Report format: markdown, json, or sarif. Defaults to markdown.
  --sarif <path>         Import a local SARIF artifact. Can be repeated.
  --codeql <path>        Import a local CodeQL SARIF artifact. Can be repeated.
  --semgrep <path>       Import a local Semgrep JSON or SARIF artifact. Can be repeated.
  --snyk <path>          Import a local Snyk JSON or SARIF artifact. Can be repeated.
  --summary-only         Write a short GitHub Actions-friendly summary. This is the default.
  --full-report          Write the complete Markdown report with detailed findings.
  --pr-comment           Write a compact Markdown summary suitable for GitHub PR comments.
  --fail-on <risk>       Exit 1 when overall risk meets the threshold: high or critical.
  --help                 Show this help message.
`;

export function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {
    help: false,
    reportStyle: "summary",
    sarifPaths: [],
    codeqlPaths: [],
    semgrepPaths: [],
    snykPaths: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--repo") {
      parsed.repo = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--base") {
      parsed.base = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--out") {
      parsed.out = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--format") {
      parsed.format = parseReportFormat(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--sarif") {
      parsed.sarifPaths.push(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--codeql") {
      parsed.codeqlPaths.push(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--semgrep") {
      parsed.semgrepPaths.push(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--snyk") {
      parsed.snykPaths.push(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--summary-only") {
      parsed.reportStyle = "summary";
      continue;
    }

    if (arg === "--full-report") {
      parsed.reportStyle = "full";
      continue;
    }

    if (arg === "--pr-comment") {
      parsed.reportStyle = "pr-comment";
      continue;
    }

    if (arg === "--fail-on") {
      parsed.failOn = parseFailOn(readValue(args, index, arg));
      index += 1;
      continue;
    }

    throw new Error(`Unknown flag: ${arg}`);
  }

  return parsed;
}

export async function runGuardianCli(options: CliRunOptions): Promise<CliRunResult> {
  const stdout = options.stdout ?? process.stdout;
  const args = parseArgs(options.argv);

  if (args.help) {
    stdout.write(helpText);
    return { exitCode: 0 };
  }

  const config = loadConfig({
    repoPath: args.repo,
    baseRef: args.base,
    outputPath: args.out,
    format: args.format,
    sarifPaths: args.sarifPaths,
    codeqlPaths: args.codeqlPaths,
    semgrepPaths: args.semgrepPaths,
    snykPaths: args.snykPaths
  });
  const report = await runGuardianCore(config);
  const rendered = renderReport(report, config.format, args.reportStyle);

  if (config.outputPath === undefined) {
    stdout.write(rendered);
  } else {
    await writeFile(config.outputPath, rendered, "utf8");
    stdout.write(`Guardian report written to ${config.outputPath}\n`);
  }

  return {
    exitCode: shouldFailBuild(args.failOn, report.overallRisk) ? 1 : 0,
    outputPath: config.outputPath,
    overallRisk: report.overallRisk
  };
}

export function shouldFailBuild(failOn: FailOnRisk | undefined, overallRisk: RiskLevel): boolean {
  if (failOn === undefined) {
    return false;
  }

  if (failOn === "critical") {
    return overallRisk === "critical";
  }

  return overallRisk === "high" || overallRisk === "critical";
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parseFailOn(value: string): FailOnRisk {
  if (value === "high" || value === "critical") {
    return value;
  }

  throw new Error(`Unsupported --fail-on value: ${value}. Expected "high" or "critical".`);
}

function parseReportFormat(value: string): ReportFormat {
  if (value === "markdown" || value === "json" || value === "sarif") {
    return value;
  }

  throw new Error(`Unsupported --format value: ${value}. Expected "markdown", "json", or "sarif".`);
}
