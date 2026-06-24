import type { CliConfig } from "../config/loadConfig.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeQa } from "../analyzers/qaAnalyzer.js";
import { analyzeCoverage } from "../analyzers/coverageAnalyzer.js";
import { analyzeRelease } from "../analyzers/releaseAnalyzer.js";
import { analyzeSecurity } from "../analyzers/securityAnalyzer.js";
import { analyzeEnterpriseRiskCorrelation } from "../analyzers/enterpriseRiskCorrelation.js";
import { analyzeBusinessAreas } from "../analyzers/businessAreaAnalyzer.js";
import { analyzeWorkflows } from "../analyzers/workflowAnalyzer.js";
import { buildDomainCoverageSuggestions } from "../analyzers/domainCoverageAnalyzer.js";
import { scoreRisk } from "../analyzers/riskScorer.js";
import { loadProjectBrain } from "../project-brain/loadProjectBrain.js";
import { classifyFile } from "../repo/fileClassifier.js";
import { getChangedFilesWithWarnings } from "../repo/getChangedFiles.js";
import { filterIgnoredChangedFiles } from "../repo/ignoredChangedFiles.js";
import type { GuardianReport } from "./types.js";
import { listRepoFiles } from "../repo/listRepoFiles.js";
import { applyBaseline, loadBaseline } from "./baseline.js";
import { buildActionableGuidance, buildRequiredDeployActions } from "./actionableGuidance.js";
import { buildReportDecisionSupport } from "./reportDecisionSupport.js";

export async function runGuardian(config: CliConfig): Promise<GuardianReport> {
  const changedFileResult = await getChangedFilesWithWarnings({
    repoPath: config.repoPath,
    baseRef: config.baseRef
  });
  const changedFiles = filterIgnoredChangedFiles(changedFileResult.changedFiles).map((file) => {
    const classification = classifyFile(file.path, config.guardian);

    return {
      ...file,
      category: classification.category,
      riskLevel: classification.riskLevel
    };
  });

  const repoFiles = await listRepoFiles({ repoPath: config.repoPath });
  const projectBrainResult = loadProjectBrain(config.repoPath);
  const testFileContents = await readChangedTestFileContents(config.repoPath, changedFiles);
  const qaFindings = analyzeQa({
    changedFiles,
    repoFiles,
    config: config.guardian,
    projectBrain: projectBrainResult.projectBrain,
    testFileContents
  });
  const coverageFindings = await analyzeCoverage({
    repoPath: config.repoPath,
    changedFiles,
    coverageThreshold: config.guardian.coverageThreshold
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
  const workflowFindings = await analyzeWorkflows({
    repoPath: config.repoPath,
    repoFiles,
    config: config.guardian
  });
  const baselineResult = await loadBaseline(config.repoPath);
  const baselineApplied = applyBaseline(
    [
      ...qaFindings,
      ...coverageFindings,
      ...releaseFindings,
      ...businessAreaFindings.qaFindings,
      ...businessAreaFindings.releaseFindings,
      ...securityFindings,
      ...workflowFindings
    ],
    baselineResult.baseline
  );
  const activeQaFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "qa");
  const activeReleaseFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "release");
  const activeSecurityFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "security");
  const activeWorkflowFindings = baselineApplied.activeFindings.filter((finding) => finding.area === "workflow");
  const enterpriseRiskCorrelation = await analyzeEnterpriseRiskCorrelation({
    artifacts: config.externalArtifacts,
    securityFindings: activeSecurityFindings
  });
  const requiredDeployActions = buildRequiredDeployActions(activeReleaseFindings);
  const actionableGuidance = buildActionableGuidance([
    ...activeReleaseFindings,
    ...activeQaFindings,
    ...activeSecurityFindings,
    ...activeWorkflowFindings
  ]);
  const suggestedReview = buildDomainCoverageSuggestions(changedFiles);
  const riskScore = scoreRisk({
    changedFiles,
    qaFindings: activeQaFindings,
    releaseFindings: activeReleaseFindings,
    securityFindings: activeSecurityFindings,
    workflowFindings: activeWorkflowFindings,
    externalFindings: enterpriseRiskCorrelation.externalFindings,
    correlatedFindings: enterpriseRiskCorrelation.correlatedFindings
  });
  const decisionSupport = buildReportDecisionSupport({
    overallRisk: riskScore.overallRisk,
    scoreBreakdown: riskScore.scoreBreakdown,
    qaFindings: activeQaFindings,
    releaseFindings: activeReleaseFindings,
    securityFindings: activeSecurityFindings,
    workflowFindings: activeWorkflowFindings,
    externalFindings: enterpriseRiskCorrelation.externalFindings,
    correlatedFindings: enterpriseRiskCorrelation.correlatedFindings
  });

  return {
    projectName: config.guardian.projectName,
    generatedAt: new Date().toISOString(),
    riskScore: riskScore.score,
    overallRisk: riskScore.overallRisk,
    ...decisionSupport,
    scoreBreakdown: riskScore.scoreBreakdown,
    changedFiles,
    qaFindings: activeQaFindings,
    releaseFindings: activeReleaseFindings,
    securityFindings: activeSecurityFindings,
    workflowFindings: activeWorkflowFindings,
    enterpriseRiskCorrelation,
    acceptedFindings: baselineApplied.acceptedFindings,
    requiredDeployActions,
    actionableGuidance,
    ...(suggestedReview.length === 0 ? {} : { suggestedReview }),
    requiredActions: requiredDeployActions,
    warnings: [
      ...config.warnings,
      ...changedFileResult.warnings,
      ...projectBrainResult.warnings,
      ...baselineResult.warnings,
      ...enterpriseRiskCorrelation.warnings
    ]
  };
}

async function readChangedTestFileContents(repoPath: string, changedFiles: GuardianReport["changedFiles"]): Promise<Record<string, string>> {
  const testPathPattern = /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i;
  const entries = await Promise.all(
    changedFiles
      .filter((file) => file.status !== "deleted" && testPathPattern.test(file.path))
      .map(async (file): Promise<[string, string] | undefined> => {
        try {
          return [file.path, await readFile(join(repoPath, file.path), "utf8")];
        } catch {
          return undefined;
        }
      })
  );

  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry !== undefined));
}
