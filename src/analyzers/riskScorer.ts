import { basename, extname } from "node:path";
import type {
  ChangedFile,
  CorrelatedFinding,
  ExternalFinding,
  QaFinding,
  ReleaseFinding,
  RiskLevel,
  ScoreBreakdown,
  SecurityFinding,
  WorkflowFinding
} from "../core/types.js";

export type RiskScoreInput = {
  changedFiles: ChangedFile[];
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  workflowFindings?: WorkflowFinding[];
  externalFindings?: ExternalFinding[];
  correlatedFindings?: CorrelatedFinding[];
};

export type RiskScoreResult = {
  score: number;
  overallRisk: RiskLevel;
  scoreBreakdown: ScoreBreakdown;
};

type RiskBandName = "documentation" | "config" | "workflow" | "source" | "migration" | "auth" | "security";

type RiskBand = {
  name: RiskBandName;
  base: number;
  max: number;
  factor: number;
};

const riskBands: Record<RiskBandName, RiskBand> = {
  documentation: { name: "documentation", base: 4, max: 10, factor: 1.5 },
  config: { name: "config", base: 20, max: 50, factor: 2 },
  workflow: { name: "workflow", base: 20, max: 40, factor: 2 },
  source: { name: "source", base: 32, max: 60, factor: 2 },
  migration: { name: "migration", base: 50, max: 80, factor: 2 },
  auth: { name: "auth", base: 60, max: 90, factor: 2 },
  security: { name: "security", base: 70, max: 100, factor: 2 }
};

const categoryWeights: Record<ChangedFile["category"], number> = {
  source: 4,
  test: 0,
  migration: 10,
  config: 3,
  ci: 8,
  documentation: 0,
  "project-brain": 0,
  "generated-report": 0,
  i18n: 1,
  security: 10,
  unknown: 1
};

const riskLevelWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 5
};

const qaFindingWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 3,
  medium: 5,
  high: 8,
  critical: 13
};

const releaseFindingWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 2,
  medium: 5,
  high: 8,
  critical: 13
};

const workflowFindingWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 4,
  medium: 7,
  high: 10,
  critical: 14
};

const securityFindingWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 5,
  medium: 10,
  high: 18,
  critical: 60
};

const criticalCombinationMinimumScore = 91;
const criticalScannerMinimumScore = 81;
const changedFileOnlyScoreCap = 60;

export function scoreRisk(input: RiskScoreInput): RiskScoreResult {
  return calculateRiskScore(input);
}

export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  if (hasNoRiskSignals(input)) {
    return {
      score: 0,
      overallRisk: "info",
      scoreBreakdown: emptyScoreBreakdown()
    };
  }

  const band = selectRiskBand(input);
  const componentScores = scoreWeightedSignals(input, band.name);
  const weightedSignal = totalWeightedSignal(componentScores);
  const bandedScore = Math.min(band.max, band.base + Math.ceil(Math.sqrt(weightedSignal) * band.factor));
  const criticalFloor = scoreFloor(input);
  const cappedBandedScore = capChangedFileOnlyScore(bandedScore, input);
  const scoreBeforeClamp = criticalFloor === undefined ? cappedBandedScore : Math.max(cappedBandedScore, criticalFloor.floor);
  const score = clampScore(scoreBeforeClamp);

  return {
    score,
    overallRisk: overallRiskForScore(score, input),
    scoreBreakdown: {
      selectedBand: band.name,
      bandBase: band.base,
      bandMax: band.max,
      bandFactor: band.factor,
      weightedSignal,
      ...componentScores,
      criticalFloorApplied: criticalFloor === undefined
        ? { applied: false }
        : {
            applied: scoreBeforeClamp > bandedScore,
            floor: criticalFloor.floor,
            reason: criticalFloor.reason
          }
    }
  };
}

export function riskLevelForScore(score: number): RiskLevel {
  if (score <= 20) {
    return "info";
  }

  if (score <= 40) {
    return "low";
  }

  if (score <= 60) {
    return "medium";
  }

  if (score <= 80) {
    return "high";
  }

  return "critical";
}

function selectRiskBand(input: RiskScoreInput): RiskBand {
  if (hasBlockingSecuritySignals(input)) {
    return riskBands.security;
  }

  if (hasAuthChange(input)) {
    return riskBands.auth;
  }

  if (hasMigrationChange(input)) {
    return riskBands.migration;
  }

  if (hasWorkflowChange(input)) {
    return riskBands.workflow;
  }

  if (hasOnlyDocumentationChanges(input)) {
    return riskBands.documentation;
  }

  if (hasOnlyConfigChanges(input)) {
    return riskBands.config;
  }

  if (hasConfigChange(input)) {
    return riskBands.config;
  }

  return riskBands.source;
}

function scoreWeightedSignals(input: RiskScoreInput, bandName: RiskBandName): Omit<
  ScoreBreakdown,
  "selectedBand" | "bandBase" | "bandMax" | "bandFactor" | "weightedSignal" | "criticalFloorApplied"
> {
  return {
    changedFileScore: scoreChangedFiles(input.changedFiles, bandName),
    qaFindingScore: scoreQaFindings(input.qaFindings),
    releaseFindingScore: scoreReleaseFindings(input.releaseFindings),
    workflowFindingScore: scoreWorkflowFindings(input.workflowFindings ?? []),
    securityFindingScore: scoreSecurityFindings(input.securityFindings),
    externalFindingScore: scoreExternalFindings(input.externalFindings ?? []),
    correlatedFindingScore: scoreCorrelatedFindings(input.correlatedFindings ?? [])
  };
}

function scoreChangedFiles(changedFiles: ChangedFile[], bandName: RiskBandName): number {
  return changedFiles.reduce((score, file) => {
    if (isNonProductionContextFile(file)) {
      return score;
    }

    if (isDocumentationFile(file) && bandName !== "documentation") {
      return score;
    }

    const categoryWeight = bandName === "documentation" && isDocumentationFile(file) ? 1 : categoryWeights[file.category];
    return score + categoryWeight + riskLevelWeights[file.riskLevel];
  }, 0);
}

function scoreQaFindings(findings: QaFinding[]): number {
  return findings.reduce((score, finding) => score + qaFindingWeights[finding.riskLevel], 0);
}

function scoreReleaseFindings(findings: ReleaseFinding[]): number {
  return findings.reduce((score, finding) => score + releaseFindingWeights[finding.riskLevel], 0);
}

function scoreWorkflowFindings(findings: WorkflowFinding[]): number {
  return findings.reduce((score, finding) => score + workflowFindingWeights[finding.riskLevel], 0);
}

function scoreSecurityFindings(findings: SecurityFinding[]): number {
  return findings.reduce((score, finding) => score + securityFindingWeights[finding.riskLevel], 0);
}

function scoreExternalFindings(findings: ExternalFinding[]): number {
  return Math.min(
    60,
    findings.reduce((score, finding) => score + externalFindingWeight(finding.riskLevel), 0)
  );
}

function scoreCorrelatedFindings(findings: CorrelatedFinding[]): number {
  return Math.min(
    30,
    findings
      .filter((finding) => finding.confidence === "multi-tool")
      .reduce((score, finding) => score + 8 + finding.sources.length * 2 + riskLevelWeights[finding.riskLevel], 0)
  );
}

function totalWeightedSignal(scores: ReturnType<typeof scoreWeightedSignals>): number {
  return (
    scores.changedFileScore +
    scores.qaFindingScore +
    scores.releaseFindingScore +
    scores.workflowFindingScore +
    scores.securityFindingScore +
    scores.externalFindingScore +
    scores.correlatedFindingScore
  );
}

function scoreFloor(input: RiskScoreInput): { floor: number; reason: string } | undefined {
  if (hasMigrationWithoutDbTest(input)) {
    return {
      floor: criticalCombinationMinimumScore,
      reason: "Migration changed without clear DB/integration test signal"
    };
  }

  if (hasAuthChangeWithoutNegativeTest(input)) {
    return {
      floor: criticalCombinationMinimumScore,
      reason: "Auth/security-sensitive change with no related test signal"
    };
  }

  if (hasPaymentChangeWithoutIntegrationTest(input)) {
    return {
      floor: criticalCombinationMinimumScore,
      reason: "Payment code changed without clear API/integration test signal"
    };
  }

  if (hasCriticalExternalScannerFinding(input)) {
    return {
      floor: criticalScannerMinimumScore,
      reason: "Critical external scanner finding"
    };
  }

  if (hasMultiToolCriticalCorrelation(input)) {
    return {
      floor: criticalScannerMinimumScore,
      reason: "Critical multi-tool scanner correlation"
    };
  }

  return undefined;
}

function overallRiskForScore(score: number, input: RiskScoreInput): RiskLevel {
  const riskLevel = riskLevelForScore(score);

  if (riskLevel === "critical" && !hasCriticalPrerequisite(input)) {
    return "high";
  }

  return riskLevel;
}

function hasCriticalPrerequisite(input: RiskScoreInput): boolean {
  return (
    hasHighOrCriticalSecurityFinding(input) ||
    hasCriticalExternalScannerFinding(input) ||
    hasMultiToolCriticalCorrelation(input) ||
    hasScoreElevatingCriticalCombination(input)
  );
}

function hasScoreElevatingCriticalCombination(input: RiskScoreInput): boolean {
  return hasMigrationWithoutDbTest(input) || hasAuthChangeWithoutNegativeTest(input) || hasPaymentChangeWithoutIntegrationTest(input);
}

function emptyScoreBreakdown(): ScoreBreakdown {
  return {
    selectedBand: "none",
    bandBase: 0,
    bandMax: 0,
    bandFactor: 0,
    weightedSignal: 0,
    changedFileScore: 0,
    qaFindingScore: 0,
    releaseFindingScore: 0,
    securityFindingScore: 0,
    workflowFindingScore: 0,
    externalFindingScore: 0,
    correlatedFindingScore: 0,
    criticalFloorApplied: { applied: false }
  };
}

function hasMultiToolCriticalCorrelation(input: RiskScoreInput): boolean {
  return (input.correlatedFindings ?? []).some((finding) => finding.confidence === "multi-tool" && finding.riskLevel === "critical");
}

function hasCriticalExternalScannerFinding(input: RiskScoreInput): boolean {
  return (input.externalFindings ?? []).some((finding) => finding.riskLevel === "critical");
}

function hasBlockingSecuritySignals(input: RiskScoreInput): boolean {
  return (
    hasHighOrCriticalSecurityFinding(input) ||
    (input.externalFindings ?? []).some(isHighOrCriticalFinding) ||
    (input.correlatedFindings ?? []).some(isHighOrCriticalFinding)
  );
}

function hasHighOrCriticalSecurityFinding(input: RiskScoreInput): boolean {
  return input.securityFindings.some(isHighOrCriticalFinding);
}

function isHighOrCriticalFinding(finding: { riskLevel: RiskLevel }): boolean {
  return finding.riskLevel === "high" || finding.riskLevel === "critical";
}

function externalFindingWeight(riskLevel: RiskLevel): number {
  if (riskLevel === "critical") {
    return 60;
  }

  if (riskLevel === "high") {
    return 24;
  }

  if (riskLevel === "medium") {
    return 8;
  }

  if (riskLevel === "low") {
    return 3;
  }

  return 0;
}

function hasMigrationWithoutDbTest(input: RiskScoreInput): boolean {
  return (
    hasMigrationChange(input) &&
    input.qaFindings.some((finding) => finding.id === "qa-migration-without-db-test")
  );
}

function hasAuthChangeWithoutNegativeTest(input: RiskScoreInput): boolean {
  return (
    hasAuthChange(input) &&
    input.qaFindings.some(
      (finding) =>
        finding.id === "qa-auth-security-without-negative-test" &&
        (finding.testSignalEvidence?.detectedRelatedTests.length ?? 0) === 0
    )
  );
}

function hasPaymentChangeWithoutIntegrationTest(input: RiskScoreInput): boolean {
  const paymentFiles = input.changedFiles.filter((file) => isPaymentPath(file.path));

  return (
    paymentFiles.length > 0 &&
    input.qaFindings.some(
      (finding) =>
        finding.id === "qa-api-without-integration-test" &&
        paymentFiles.some((file) => finding.affectedFiles.some((affectedFile) => normalizePath(affectedFile) === normalizePath(file.path)))
    )
  );
}

function hasAuthChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some(isProductionAuthFile);
}

function hasMigrationChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some((file) => file.category === "migration" || isMigrationPath(file.path));
}

function hasWorkflowChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some((file) => file.category === "ci" || isWorkflowPath(file.path)) || (input.workflowFindings ?? []).length > 0;
}

function hasOnlyDocumentationChanges(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.length > 0 &&
    input.changedFiles.every((file) => isDocumentationFile(file) || isNonProductionContextFile(file)) &&
    input.qaFindings.length === 0 &&
    input.releaseFindings.length === 0 &&
    input.securityFindings.length === 0 &&
    (input.workflowFindings ?? []).length === 0
  );
}

function hasOnlyConfigChanges(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.length > 0 &&
    input.changedFiles.every((file) => file.category === "config" || isDocumentationFile(file)) &&
    input.qaFindings.length === 0 &&
    input.releaseFindings.every((finding) => finding.riskLevel !== "high" && finding.riskLevel !== "critical") &&
    input.securityFindings.length === 0 &&
    (input.workflowFindings ?? []).length === 0
  );
}

function hasConfigChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some((file) => file.category === "config" || isDeployConfigPath(file.path));
}

function hasNoRiskSignals(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.filter((file) => !isNonProductionContextFile(file)).length === 0 &&
    input.qaFindings.length === 0 &&
    input.releaseFindings.length === 0 &&
    input.securityFindings.length === 0 &&
    (input.workflowFindings ?? []).length === 0
  );
}

function isProductionAuthFile(file: ChangedFile): boolean {
  if (
    file.status === "deleted" ||
    file.category === "ci" ||
    file.category === "config" ||
    file.category === "documentation" ||
    file.category === "project-brain" ||
    file.category === "generated-report" ||
    file.category === "test" ||
    isGeneratedGuardianReportPath(file.path)
  ) {
    return false;
  }

  const normalizedPath = normalizePath(file.path);

  if (/^src\/(auth|security)(\/|$)/i.test(normalizedPath)) {
    return true;
  }

  return isSourceLikeFile(normalizedPath) && isStrongAuthFileName(normalizedPath);
}

function isSourceLikeFile(path: string): boolean {
  return [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"].includes(extname(path).toLowerCase());
}

function isStrongAuthFileName(path: string): boolean {
  const name = basename(path).replace(/\.[^.]+$/, "");
  return /^(authService|login|jwt|session|permission|access-control)$/i.test(name);
}

function isPaymentPath(path: string): boolean {
  return /(^|\/)(billing|checkout|invoice|payment|payments|stripe|subscription|subscriptions)(\/|\.|-|_|$)/i.test(normalizePath(path));
}

function isMigrationPath(path: string): boolean {
  return /(^|\/)(migrations?|schema|prisma\/migrations|db\/schema|database\/schema)(\/|\.|$)/i.test(normalizePath(path));
}

function isWorkflowPath(path: string): boolean {
  return /(^|\/)\.github\/(workflows|actions)(\/|$)/i.test(normalizePath(path));
}

function isDeployConfigPath(path: string): boolean {
  return /(^|\/)(\.env(\.[^.\/]+)?(\.example)?|env\.example|example\.env|config\/.*env.*|configs?\/.*env.*|settings\/.*env.*|deploy|deployment|dockerfile|docker-compose|compose|helm|k8s|kubernetes|terraform)(\.|\/|-|_|$)/i.test(
    normalizePath(path)
  );
}

function isDocumentationFile(file: ChangedFile): boolean {
  return file.category === "documentation" || file.category === "project-brain";
}

function isNonProductionContextFile(file: ChangedFile): boolean {
  return file.category === "project-brain" || file.category === "generated-report" || isGeneratedGuardianReportPath(file.path);
}

function hasFindingSignals(input: RiskScoreInput): boolean {
  return (
    input.qaFindings.length > 0 ||
    input.releaseFindings.length > 0 ||
    input.securityFindings.length > 0 ||
    (input.workflowFindings ?? []).length > 0 ||
    (input.externalFindings ?? []).length > 0 ||
    (input.correlatedFindings ?? []).length > 0
  );
}

function capChangedFileOnlyScore(score: number, input: RiskScoreInput): number {
  if (hasFindingSignals(input)) {
    return score;
  }

  return Math.min(score, changedFileOnlyScoreCap);
}

function isGeneratedGuardianReportPath(path: string): boolean {
  return /(^|\/)guardian-report\.md$/i.test(normalizePath(path));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
