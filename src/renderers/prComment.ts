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
    "### AI Project Guardian",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Risk score | ${report.riskScore}/100 |`,
    `| Overall risk | **${report.overallRisk}** |`,
    "",
    "**Summary**",
    "",
    `- ${formatCount(report.changedFiles.length, "changed file")}`,
    `- ${formatCount(totalActiveFindings(report), "active finding")}`,
    `- ${formatCount(report.requiredActions.length, "required action")}`,
    "",
    "**Top Findings**",
    "",
    ...listItems(findings.slice(0, maxTopFindings).map(renderFindingItem)),
    "",
    "**Required Actions**",
    "",
    ...taskItems(actions.slice(0, maxActions))
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

function taskItems(items: string[]): string[] {
  if (items.length === 0) {
    return ["- [ ] No required actions."];
  }

  return items.map((item) => `- [ ] ${item}`);
}

function renderFindingItem(finding: GuardianFinding): string {
  const location = findingLocation(finding);

  if (location === undefined) {
    return `**${finding.riskLevel}** ${finding.area}: ${finding.title}`;
  }

  return `**${finding.riskLevel}** ${finding.area}: ${finding.title} (${location})`;
}

function findingLocation(finding: GuardianFinding): string | undefined {
  if (finding.filePath !== undefined) {
    return finding.area === "security" && finding.lineNumber !== undefined ? `${finding.filePath}:${finding.lineNumber}` : finding.filePath;
  }

  if ("affectedFiles" in finding && finding.affectedFiles.length > 0) {
    return finding.affectedFiles[0];
  }

  if (finding.area === "workflow") {
    return finding.workflowFile;
  }

  return undefined;
}

function totalActiveFindings(report: GuardianReport): number {
  return report.qaFindings.length + report.releaseFindings.length + report.securityFindings.length + report.workflowFindings.length;
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
