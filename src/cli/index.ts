#!/usr/bin/env node

import { runGuardianCli } from "./runGuardian.js";

async function main(): Promise<void> {
  const result = await runGuardianCli({ argv: process.argv.slice(2) });
  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ai-project-guardian failed: ${message}\n`);
  process.exitCode = 1;
});
