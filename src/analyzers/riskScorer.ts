import type { ChangedFile, QaFinding, ReleaseFinding, RiskLevel, SecurityFinding, WorkflowFinding } from "../core/types.js";

export type RiskScoreInput = {
  changedFiles: ChangedFile[];
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  workflowFindings?: WorkflowFinding[];
};

export type RiskScoreResult = {
  score: number;
  overallRisk: RiskLevel;
};

const changedFileWeights: Record<RiskLevel, number> = {
  info: 1,
  low: 4,
  medium: 8,
  high: 13,
  critical: 20
};

const findingWeights: Record<RiskLevel, number> = {
  info: 3,
  low: 7,
  medium: 12,
  high: 18,
  critical: 28
};

const criticalSecurityMinimumScore = 81;
const migrationMissingDbTestBoost = 15;
const authMissingNegativeTestBoost = 15;

export function scoreRisk(input: RiskScoreInput): RiskScoreResult {
  const baseScore =
    scoreChangedFiles(input.changedFiles) +
    scoreFindings(input.qaFindings) +
    scoreFindings(input.releaseFindings) +
    scoreFindings(input.workflowFindings ?? []) +
    scoreSecurityFindings(input.securityFindings);
  const boostedScore = applyContextBoosts(baseScore, input);
  const securityAdjustedScore = applySecurityFloor(boostedScore, input.securityFindings);
  const score = clampScore(securityAdjustedScore);

  return {
    score,
    overallRisk: riskLevelForScore(score)
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

function scoreChangedFiles(changedFiles: ChangedFile[]): number {
  return changedFiles.reduce((score, file) => score + changedFileWeights[file.riskLevel], 0);
}

function scoreFindings(findings: Array<QaFinding | ReleaseFinding | WorkflowFinding>): number {
  return findings.reduce((score, finding) => score + findingWeights[finding.riskLevel], 0);
}

function scoreSecurityFindings(findings: SecurityFinding[]): number {
  return findings.reduce((score, finding) => {
    const weight = findingWeights[finding.riskLevel];
    const securityWeight = finding.riskLevel === "critical" ? weight * 2 : Math.ceil(weight * 1.25);

    return score + securityWeight;
  }, 0);
}

function applyContextBoosts(score: number, input: RiskScoreInput): number {
  let boostedScore = score;

  if (hasMigrationWithoutDbTest(input)) {
    boostedScore += migrationMissingDbTestBoost;
  }

  if (hasAuthChangeWithoutNegativeTest(input)) {
    boostedScore += authMissingNegativeTestBoost;
  }

  return boostedScore;
}

function applySecurityFloor(score: number, securityFindings: SecurityFinding[]): number {
  if (securityFindings.some((finding) => finding.riskLevel === "critical")) {
    return Math.max(score, criticalSecurityMinimumScore);
  }

  return score;
}

function hasMigrationWithoutDbTest(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.some((file) => file.category === "migration") &&
    input.qaFindings.some((finding) => finding.id === "qa-migration-without-db-test")
  );
}

function hasAuthChangeWithoutNegativeTest(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.some((file) => file.category === "security" || isAuthPath(file.path)) &&
    input.qaFindings.some((finding) => finding.id === "qa-auth-security-without-negative-test")
  );
}

function isAuthPath(path: string): boolean {
  return /(^|\/)(auth|authentication|authorization|crypto|jwt|oauth|password|permissions|secrets?|security|session)(\/|\.|-|_|$)/i.test(
    path.replaceAll("\\", "/")
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
