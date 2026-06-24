import type {
  CorrelatedFinding,
  ExternalFinding,
  MergeRecommendation,
  QaFinding,
  ReleaseFinding,
  RiskLevel,
  ScoreBreakdown,
  SecurityFinding,
  WorkflowFinding
} from "./types.js";

export type ReportDecisionSupportInput = {
  overallRisk: RiskLevel;
  scoreBreakdown: ScoreBreakdown;
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  workflowFindings: WorkflowFinding[];
  externalFindings: ExternalFinding[];
  correlatedFindings: CorrelatedFinding[];
};

export type ReportDecisionSupport = {
  blockingFindingsCount: number;
  checklistFindingsCount: number;
  mergeRecommendation: MergeRecommendation;
  codeRisk: RiskLevel;
  releaseChecklistRisk: RiskLevel;
  riskReason: string;
};

const riskRank: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function buildReportDecisionSupport(input: ReportDecisionSupportInput): ReportDecisionSupport {
  const blockingQaFindings = input.qaFindings.filter(isBlockingQaFinding);
  const blockingFindings = [
    ...blockingQaFindings,
    ...input.securityFindings.filter(isBlockingSecurityRisk),
    ...input.workflowFindings,
    ...input.externalFindings.filter(isBlockingSecurityRisk),
    ...input.correlatedFindings.filter(isBlockingCorrelatedRisk)
  ];
  const hasBlockingSecurityFindings =
    input.securityFindings.some(isBlockingSecurityRisk) ||
    input.externalFindings.some(isBlockingSecurityRisk) ||
    input.correlatedFindings.some(isBlockingCorrelatedRisk);
  const checklistFindings = input.releaseFindings;
  const reviewOnlyQaFindingsCount = input.qaFindings.length - blockingQaFindings.length;
  const blockingFindingsCount = blockingFindings.length;
  const checklistFindingsCount = checklistFindings.length;
  const codeRisk = codeRiskFrom({
    blockingRiskLevels: blockingFindings.map((finding) => finding.riskLevel),
    selectedBand: input.scoreBreakdown.selectedBand
  });
  const releaseChecklistRisk = highestRisk(checklistFindings.map((finding) => finding.riskLevel));

  return {
    blockingFindingsCount,
    checklistFindingsCount,
    mergeRecommendation: recommendMerge({
      blockingFindingsCount,
      checklistFindingsCount,
      codeRisk,
      overallRisk: input.overallRisk,
      authSecurityCriticalFloorApplied: hasAuthSecurityCriticalFloor(input.scoreBreakdown) && blockingQaFindings.length > 0,
      hasBlockingSecurityFindings,
      reviewOnlyQaFindingsCount
    }),
    codeRisk,
    releaseChecklistRisk,
    riskReason: buildRiskReason({
      overallRisk: input.overallRisk,
      blockingFindingsCount,
      checklistFindingsCount,
      codeRisk,
      releaseChecklistRisk,
      hasSecurityFindings: hasBlockingSecurityFindings,
      reviewOnlyQaFindingsCount,
      criticalFloorReason: input.scoreBreakdown.criticalFloorApplied?.reason
    })
  };
}

function isBlockingQaFinding(finding: QaFinding): boolean {
  return (
    finding.id === "qa-auth-security-without-negative-test" &&
    (finding.confidence ?? 0) >= 50 &&
    (finding.testSignalEvidence?.detectedRelatedTests.length ?? 0) === 0
  );
}

function isBlockingSecurityRisk(finding: { riskLevel: RiskLevel; blocking?: boolean }): boolean {
  return finding.blocking !== false && (finding.riskLevel === "high" || finding.riskLevel === "critical");
}

function isBlockingCorrelatedRisk(finding: CorrelatedFinding): boolean {
  return finding.confidence === "multi-tool" && isBlockingSecurityRisk(finding);
}

function recommendMerge(input: {
  blockingFindingsCount: number;
  checklistFindingsCount: number;
  codeRisk: RiskLevel;
  overallRisk: RiskLevel;
  authSecurityCriticalFloorApplied: boolean;
  hasBlockingSecurityFindings: boolean;
  reviewOnlyQaFindingsCount: number;
}): MergeRecommendation {
  if (input.authSecurityCriticalFloorApplied) {
    return "blocked";
  }

  if (input.blockingFindingsCount > 0) {
    if (input.hasBlockingSecurityFindings || input.codeRisk === "critical") {
      return "blocked";
    }

    return "review_required";
  }

  if (input.reviewOnlyQaFindingsCount > 0) {
    return "review_required";
  }

  if (input.checklistFindingsCount > 0) {
    return "safe_after_checklist";
  }

  if (input.overallRisk === "info" || input.overallRisk === "low" || input.overallRisk === "medium") {
    return "safe";
  }

  return "review_required";
}

function highestRisk(risks: RiskLevel[]): RiskLevel {
  return risks.reduce<RiskLevel>((highest, risk) => (riskRank[risk] > riskRank[highest] ? risk : highest), "info");
}

function codeRiskFrom(input: { blockingRiskLevels: RiskLevel[]; selectedBand: string }): RiskLevel {
  const blockingRisk = highestRisk(input.blockingRiskLevels);

  if (blockingRisk !== "info") {
    return blockingRisk;
  }

  if (input.selectedBand === "auth" || input.selectedBand === "security") {
    return "medium";
  }

  return "info";
}

function buildRiskReason(input: {
  overallRisk: RiskLevel;
  blockingFindingsCount: number;
  checklistFindingsCount: number;
  codeRisk: RiskLevel;
  releaseChecklistRisk: RiskLevel;
  hasSecurityFindings: boolean;
  reviewOnlyQaFindingsCount: number;
  criticalFloorReason?: string;
}): string {
  if (input.criticalFloorReason === "Auth/security-sensitive change with no related test signal" && input.blockingFindingsCount > 0) {
    return "Auth/security-sensitive files changed with no related test signal; negative-path coverage was not confirmed.";
  }

  if (input.hasSecurityFindings) {
    return "Security findings require review.";
  }

  if (input.blockingFindingsCount > 0) {
    return `${input.blockingFindingsCount} blocking finding(s) require review before merge. Code risk: ${input.codeRisk}. Current overall risk remains ${input.overallRisk}.`;
  }

  if (input.reviewOnlyQaFindingsCount > 0) {
    return `${input.reviewOnlyQaFindingsCount} QA finding(s) need review, but are not blocking.`;
  }

  if (input.checklistFindingsCount > 0) {
    return "Only release checklist items remain.";
  }

  return "No blocking findings remain.";
}

function hasAuthSecurityCriticalFloor(scoreBreakdown: ScoreBreakdown): boolean {
  return (
    scoreBreakdown.criticalFloorApplied?.applied === true &&
    scoreBreakdown.criticalFloorApplied.reason === "Auth/security-sensitive change with no related test signal"
  );
}
