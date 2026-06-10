import type { CliConfig } from "../config/loadConfig.js";
import { analyzeQa } from "../analyzers/qaAnalyzer.js";
import { analyzeRelease } from "../analyzers/releaseAnalyzer.js";
import { analyzeSecurity } from "../analyzers/securityAnalyzer.js";
import { analyzeBusinessAreas } from "../analyzers/businessAreaAnalyzer.js";
import { scoreRisk } from "../analyzers/riskScorer.js";
import { loadProjectBrain } from "../project-brain/loadProjectBrain.js";
import { classifyFile } from "../repo/fileClassifier.js";
import { getChangedFiles } from "../repo/getChangedFiles.js";
import type { GuardianReport } from "./types.js";
import { listRepoFiles } from "../repo/listRepoFiles.js";
import { applyBaseline, loadBaseline } from "./baseline.js";

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
  const businessAreaFindings = analyzeBusinessAreas({
    changedFiles,
    repoFiles,
    config: config.guardian
  });
  const securityFindings = await analyzeSecurity({
    repoPath: config.repoPath,
    changedFiles
  });
  const baselineResult = await loadBaseline(config.repoPath);
  const baselineApplied = applyBaseline(
    [
      ...qaFindings,
      ...releaseFindings,
      ...businessAreaFindings.qaFindings,
      ...businessAreaFindings.releaseFindings,
      ...securityFindings
    ],
    baselineResult.baseline
  );
  const activeQaFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "qa");
  const activeReleaseFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "release");
  const activeSecurityFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "security");
  const riskScore = scoreRisk({
    changedFiles,
    qaFindings: activeQaFindings,
    releaseFindings: activeReleaseFindings,
    securityFindings: activeSecurityFindings
  });

  return {
    projectName: config.guardian.projectName,
    generatedAt: new Date().toISOString(),
    riskScore: riskScore.score,
    overallRisk: riskScore.overallRisk,
    changedFiles,
    qaFindings: activeQaFindings,
    releaseFindings: activeReleaseFindings,
    securityFindings: activeSecurityFindings,
    acceptedFindings: baselineApplied.acceptedFindings,
    requiredActions: activeReleaseFindings.flatMap((finding) => finding.requiredBeforeDeploy),
    warnings: [...config.warnings, ...projectBrainResult.warnings, ...baselineResult.warnings]
  };
}
