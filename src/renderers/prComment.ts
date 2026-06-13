import type { ActionableGuidanceItem, GuardianFinding, GuardianReport, RiskLevel } from "../core/types.js";

const maxLines = 30;
const maxTopFindings = 4;
const maxDeployActions = 5;
const maxGuidanceItems = 1;
const riskWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function renderPrComment(report: GuardianReport): string {
  const findings = prioritizedFindings(report);
  const lines = [
    "### AI Project Guardian",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Risk score | ${report.riskScore}/100 |`,
    `| Overall/combined risk | **${report.overallRisk}** |`,
    `| Merge recommendation | ${report.mergeRecommendation} |`,
    "",
    "**Summary**",
    "",
    `- ${decisionSummary(report)}`,
    `- ${formatCount(report.changedFiles.length, "changed file")}`,
    `- ${formatCount(report.blockingFindingsCount, "blocking finding")}`,
    `- ${formatCount(report.checklistFindingsCount, "release checklist finding")}`,
    `- ${formatCount(report.requiredDeployActions.length, "required deploy action")}`,
    `- ${formatCount(report.actionableGuidance.length, "actionable guidance item")}`,
    ...scoreBreakdownLines(report),
    "",
    "**Top Findings**",
    "",
    ...listItems(findings.slice(0, maxTopFindings).map(renderFindingItem)),
    "",
    ...guidanceLines(report),
    "**Required Deploy Actions**",
    ...taskItems(report.requiredDeployActions.slice(0, maxDeployActions), "No deploy-specific required actions.")
  ];

  return `${lines.slice(0, maxLines).join("\n")}\n`;
}

function prioritizedFindings(report: GuardianReport): GuardianFinding[] {
  return [...report.releaseFindings, ...report.qaFindings, ...report.securityFindings, ...report.workflowFindings].sort(
    (left, right) => riskWeights[right.riskLevel] - riskWeights[left.riskLevel]
  );
}

function listItems(items: string[]): string[] {
  if (items.length === 0) {
    return ["- None"];
  }

  return items.map((item) => `- ${item}`);
}

function taskItems(items: string[], emptyText = "No required actions."): string[] {
  if (items.length === 0) {
    return [`- [ ] ${emptyText}`];
  }

  return items.map((item) => `- [ ] ${item}`);
}

function guidanceLines(report: GuardianReport): string[] {
  if (report.overallRisk !== "high" && report.overallRisk !== "critical") {
    return [];
  }

  return [
    "**Actionable Guidance**",
    "",
    ...guidanceItems(report.actionableGuidance.slice(0, maxGuidanceItems))
  ];
}

function guidanceItems(items: ActionableGuidanceItem[]): string[] {
  if (items.length === 0) {
    return ["- [ ] No actionable guidance."];
  }

  return items.map((item) => `- [ ] **${item.riskLevel}** ${item.area}: ${item.action}`);
}

function scoreBreakdownLines(report: GuardianReport): string[] {
  if (report.overallRisk !== "high" && report.overallRisk !== "critical") {
    return [];
  }

  const breakdown = report.scoreBreakdown;
  const floor = breakdown.criticalFloorApplied;
  const floorText = floor?.applied === true ? `; floor ${floor.floor}` : "";

  return [`- Score band: ${breakdown.selectedBand}, signal ${breakdown.weightedSignal}${floorText}`];
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

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function decisionSummary(report: GuardianReport): string {
  if (report.blockingFindingsCount === 0 && report.checklistFindingsCount > 0) {
    return "No blocking code/test/security findings remain. Release checklist items still require human approval before deploy.";
  }

  if (report.blockingFindingsCount > 0) {
    return `Merge blocked because ${blockingReason(report)}.`;
  }

  return "No blocking code/test/security findings remain. No release checklist items require approval.";
}

function blockingReason(report: GuardianReport): string {
  const floorReason = report.scoreBreakdown.criticalFloorApplied?.reason;

  if (floorReason === "Auth or security changed without negative test coverage") {
    return "auth/security code changed without negative-path test coverage";
  }

  if (floorReason !== undefined) {
    return `${floorReason[0].toLowerCase()}${floorReason.slice(1)}`;
  }

  return `${report.blockingFindingsCount} blocking code/test/security finding(s) require review`;
}
