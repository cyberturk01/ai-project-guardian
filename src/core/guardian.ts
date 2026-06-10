import type { CliConfig } from "../config/loadConfig.js";
import { classifyFile } from "../repo/fileClassifier.js";
import { getChangedFiles } from "../repo/getChangedFiles.js";
import type { GuardianReport } from "./types.js";

export async function runGuardian(config: CliConfig): Promise<GuardianReport> {
  const changedFiles = await getChangedFiles({
    repoPath: config.repoPath,
    baseRef: config.baseRef
  }).then((files) =>
    files.map((file) => {
      const classification = classifyFile(file.path, config.guardian);

      return {
        ...file,
        category: classification.category,
        riskLevel: classification.riskLevel
      };
    })
  );

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
