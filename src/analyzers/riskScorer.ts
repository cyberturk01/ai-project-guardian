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

type RiskBandName = "documentation" | "config" | "workflow" | "workflowDeploy" | "source" | "migration" | "auth" | "security";

type RiskBand = {
  name: RiskBandName;
  base: number;
  max: number;
  factor: number;
};

const riskBands: Record<RiskBandName, RiskBand> = {
  documentation: { name: "documentation", base: 4, max: 10, factor: 1.5 },
  config: { name: "config", base: 15, max: 25, factor: 1.5 },
  workflow: { name: "workflow", base: 35, max: 50, factor: 2 },
  workflowDeploy: { name: "workflowDeploy", base: 58, max: 70, factor: 2 },
  source: { name: "source", base: 32, max: 60, factor: 2 },
  migration: { name: "migration", base: 68, max: 80, factor: 1.5 },
  auth: { name: "auth", base: 72, max: 90, factor: 1.2 },
  security: { name: "security", base: 82, max: 100, factor: 1.4 }
};

const categoryWeights: Record<ChangedFile["category"], number> = {
  source: 4,
  test: 0,
  migration: 10,
  config: 3,
  ci: 8,
  documentation: 0,
  "project-brain": 0,
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

export function scoreRisk(input: RiskScoreInput): RiskScoreResult {
  if (hasNoRiskSignals(input)) {
    return {
      score: 0,
      overallRisk: "info"
    };
  }

  const band = selectRiskBand(input);
  const weightedSignal = scoreWeightedSignals(input, band.name);
  const bandedScore = Math.min(band.max, band.base + Math.ceil(Math.sqrt(weightedSignal) * band.factor));
  const score = clampScore(applyCriticalCombinations(bandedScore, input));

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

function selectRiskBand(input: RiskScoreInput): RiskBand {
  if (input.securityFindings.length > 0) {
    return riskBands.security;
  }

  if (hasAuthChange(input)) {
    return riskBands.auth;
  }

  if (hasMigrationChange(input)) {
    return riskBands.migration;
  }

  if (hasWorkflowChange(input) && hasDeployConfigChange(input)) {
    return riskBands.workflowDeploy;
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

  return riskBands.source;
}

function scoreWeightedSignals(input: RiskScoreInput, bandName: RiskBandName): number {
  return (
    scoreChangedFiles(input.changedFiles, bandName) +
    scoreQaFindings(input.qaFindings) +
    scoreReleaseFindings(input.releaseFindings) +
    scoreWorkflowFindings(input.workflowFindings ?? []) +
    scoreSecurityFindings(input.securityFindings)
  );
}

function scoreChangedFiles(changedFiles: ChangedFile[], bandName: RiskBandName): number {
  return changedFiles.reduce((score, file) => {
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

function applyCriticalCombinations(score: number, input: RiskScoreInput): number {
  if (hasCriticalCombination(input)) {
    return Math.max(score, criticalCombinationMinimumScore);
  }

  return score;
}

function hasCriticalCombination(input: RiskScoreInput): boolean {
  return hasMigrationWithoutDbTest(input) || hasAuthChangeWithoutNegativeTest(input) || hasPaymentChangeWithoutIntegrationTest(input);
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
    input.qaFindings.some((finding) => finding.id === "qa-auth-security-without-negative-test")
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
  return input.changedFiles.some((file) => file.category === "security" || isAuthPath(file.path));
}

function hasMigrationChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some((file) => file.category === "migration" || isMigrationPath(file.path));
}

function hasWorkflowChange(input: RiskScoreInput): boolean {
  return input.changedFiles.some((file) => file.category === "ci" || isWorkflowPath(file.path)) || (input.workflowFindings ?? []).length > 0;
}

function hasDeployConfigChange(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.some((file) => isDeployConfigPath(file.path)) ||
    input.releaseFindings.some((finding) => finding.id === "release-stage-prod-env-mismatch" || finding.id === "release-env-config-changed")
  );
}

function hasOnlyDocumentationChanges(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.length > 0 &&
    input.changedFiles.every((file) => isDocumentationFile(file)) &&
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

function hasNoRiskSignals(input: RiskScoreInput): boolean {
  return (
    input.changedFiles.length === 0 &&
    input.qaFindings.length === 0 &&
    input.releaseFindings.length === 0 &&
    input.securityFindings.length === 0 &&
    (input.workflowFindings ?? []).length === 0
  );
}

function isAuthPath(path: string): boolean {
  return /(^|\/)(auth|authentication|authorization|crypto|jwt|oauth|password|permissions|secrets?|security|session)(\/|\.|-|_|$)/i.test(normalizePath(path));
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

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
