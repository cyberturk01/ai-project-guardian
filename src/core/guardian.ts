import type { CliConfig } from "../config/loadConfig.js";
import { getChangedFiles } from "../repo/getChangedFiles.js";
import type { GuardianReport } from "./types.js";

export async function runGuardian(config: CliConfig): Promise<GuardianReport> {
  const changedFiles = await getChangedFiles({
    repoPath: config.repoPath,
    baseRef: config.baseRef
  });

  return {
    projectName: config.guardian.projectName,
    generatedAt: new Date().toISOString(),
    overallRisk: "info",
    changedFiles,
    qaFindings: [],
    releaseFindings: [],
    securityFindings: [],
    requiredActions: [],
    warnings: [...config.warnings, "Analysis logic has not been implemented yet."]
  };
}
