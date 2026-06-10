import type { CliConfig } from "../config/loadConfig.js";
import { analyzeQa } from "../analyzers/qaAnalyzer.js";
import { analyzeRelease } from "../analyzers/releaseAnalyzer.js";
import { loadProjectBrain } from "../project-brain/loadProjectBrain.js";
import { classifyFile } from "../repo/fileClassifier.js";
import { getChangedFiles } from "../repo/getChangedFiles.js";
import { riskLevels, type GuardianReport, type RiskLevel } from "./types.js";
import { listRepoFiles } from "../repo/listRepoFiles.js";

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

  const repoFiles = await listRepoFiles({ repoPath: config.repoPath });
  const projectBrainResult = loadProjectBrain(config.repoPath);
  const qaFindings = analyzeQa({
    changedFiles,
    repoFiles,
    config: config.guardian,
    projectBrain: projectBrainResult.projectBrain
  });
  const releaseFindings = analyzeRelease({
    changedFiles,
    config: config.guardian
  });

  return {
    projectName: config.guardian.projectName,
    generatedAt: new Date().toISOString(),
    overallRisk: highestRisk([
      ...changedFiles.map((file) => file.riskLevel),
      ...qaFindings.map((finding) => finding.riskLevel),
      ...releaseFindings.map((finding) => finding.riskLevel)
    ]),
    changedFiles,
    qaFindings,
    releaseFindings,
    securityFindings: [],
    requiredActions: releaseFindings.flatMap((finding) => finding.requiredBeforeDeploy),
    warnings: [...config.warnings, ...projectBrainResult.warnings, "Security analysis has not been implemented yet."]
  };
}

function highestRisk(values: RiskLevel[]): RiskLevel {
  return values.reduce<RiskLevel>((highest, value) => {
    return riskLevels.indexOf(value) > riskLevels.indexOf(highest) ? value : highest;
  }, "info");
}
