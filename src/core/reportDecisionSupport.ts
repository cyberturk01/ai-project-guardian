import type {
  CorrelatedFinding,
  ExternalFinding,
  MergeRecommendation,
  QaFinding,
  ReleaseFinding,
  RiskLevel,
  SecurityFinding,
  WorkflowFinding
} from "./types.js";

export type ReportDecisionSupportInput = {
  overallRisk: RiskLevel;
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
  const blockingFindings = [
    ...input.qaFindings,
    ...input.securityFindings,
    ...input.workflowFindings,
    ...input.externalFindings,
    ...input.correlatedFindings
  ];
  const checklistFindings = input.releaseFindings;
  const blockingFindingsCount = blockingFindings.length;
  const checklistFindingsCount = checklistFindings.length;
  const codeRisk = highestRisk(blockingFindings.map((finding) => finding.riskLevel));
  const releaseChecklistRisk = highestRisk(checklistFindings.map((finding) => finding.riskLevel));

  return {
    blockingFindingsCount,
    checklistFindingsCount,
    mergeRecommendation: recommendMerge(blockingFindingsCount, checklistFindingsCount),
    codeRisk,
    releaseChecklistRisk,
    riskReason: buildRiskReason({
      overallRisk: input.overallRisk,
      blockingFindingsCount,
      checklistFindingsCount,
      codeRisk,
      releaseChecklistRisk
    })
  };
}

function recommendMerge(blockingFindingsCount: number, checklistFindingsCount: number): MergeRecommendation {
  if (blockingFindingsCount > 0) {
    return "block";
  }

  if (checklistFindingsCount > 0) {
    return "review-checklist";
  }

  return "merge";
}

function highestRisk(risks: RiskLevel[]): RiskLevel {
  return risks.reduce<RiskLevel>((highest, risk) => (riskRank[risk] > riskRank[highest] ? risk : highest), "info");
}

function buildRiskReason(input: {
  overallRisk: RiskLevel;
  blockingFindingsCount: number;
  checklistFindingsCount: number;
  codeRisk: RiskLevel;
  releaseChecklistRisk: RiskLevel;
}): string {
  if (input.blockingFindingsCount > 0) {
    return `${input.blockingFindingsCount} blocking finding(s) require review before merge. Code risk: ${input.codeRisk}. Current overall risk remains ${input.overallRisk}.`;
  }

  if (input.checklistFindingsCount > 0) {
    return `${input.checklistFindingsCount} release checklist finding(s) require deploy readiness review. Release checklist risk: ${input.releaseChecklistRisk}. Current overall risk remains ${input.overallRisk}.`;
  }

  return `No active blocking or release checklist findings. Current overall risk remains ${input.overallRisk}.`;
}
