#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runGuardian } from "../core/guardian.js";
import { loadConfig } from "../config/loadConfig.js";
import { renderReport } from "../renderers/renderReport.js";

const helpText = `ai-project-guardian

Usage:
  ai-project-guardian --repo <path> [--base <ref>] [--format markdown|json] [--out <path>]

Options:
  --repo <path>       Target repository path. Defaults to GUARDIAN_REPO_PATH or ".".
  --base <ref>        Base git ref for changed file detection. Defaults to origin/main.
  --format <format>   Output format: markdown or json. Defaults to markdown.
  --out <path>        Optional output file path.
  --help              Show this help message.
`;

type CliArgs = {
  repo?: string;
  base?: string;
  format?: string;
  out?: string;
  help: boolean;
};

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--repo") {
      parsed.repo = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--format") {
      parsed.format = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--base") {
      parsed.base = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--out") {
      parsed.out = args[index + 1];
      index += 1;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(helpText);
    return;
  }

  const config = loadConfig({
    repoPath: args.repo,
    baseRef: args.base,
    format: args.format,
    outputPath: args.out
  });
  const report = await runGuardian(config);
  const rendered = renderReport(report, config.format);

  if (config.outputPath) {
    await writeFile(resolve(config.outputPath), rendered, "utf8");
    process.stdout.write(`Guardian report written to ${config.outputPath}\n`);
    return;
  }

  process.stdout.write(rendered);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ai-project-guardian failed: ${message}\n`);
  process.exitCode = 1;
});
