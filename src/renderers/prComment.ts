import type { GuardianFinding, GuardianReport, RiskLevel } from "../core/types.js";

const maxLines = 30;
const maxTopFindings = 8;
const maxActions = 8;
const riskWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function renderPrComment(report: GuardianReport): string {
  const findings = prioritizedFindings(report);
  const actions = requiredActions(report, findings);
  const lines = [
    "AI Project Guardian",
    "",
    `Risk: ${report.overallRisk.toUpperCase()}`,
    "",
    "Summary:",
    `- ${formatCount(report.releaseFindings.length, "release finding")}`,
    `- ${formatCount(report.qaFindings.length, "QA finding")}`,
    `- ${formatCount(report.securityFindings.length, "security finding")}`,
    `- ${formatCount(report.workflowFindings.length, "workflow finding")}`,
    "",
    "Top Findings:",
    ...listItems(findings.slice(0, maxTopFindings).map((finding) => finding.title)),
    "",
    "Required Actions:",
    ...listItems(actions.slice(0, maxActions))
  ];

  return `${lines.slice(0, maxLines).join("\n")}\n`;
}

function prioritizedFindings(report: GuardianReport): GuardianFinding[] {
  return [...report.releaseFindings, ...report.qaFindings, ...report.securityFindings, ...report.workflowFindings].sort(
    (left, right) => riskWeights[right.riskLevel] - riskWeights[left.riskLevel]
  );
}

function requiredActions(report: GuardianReport, findings: GuardianFinding[]): string[] {
  return unique([
    ...report.requiredActions,
    ...findings.flatMap((finding) => {
      if (finding.area === "release") {
        return finding.requiredBeforeDeploy;
      }

      if (finding.area === "qa") {
        return finding.suggestedTests;
      }

      return finding.recommendation === undefined ? [] : [finding.recommendation];
    })
  ]);
}

function listItems(items: string[]): string[] {
  if (items.length === 0) {
    return ["- None"];
  }

  return items.map((item) => `- ${item}`);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
