import type { GuardianReport, RiskLevel } from "../core/types.js";

export function renderMarkdownSummary(report: GuardianReport): string {
  return `# AI Project Guardian Summary

| Field | Value |
| --- | --- |
| Project | ${escapeTableCell(report.projectName)} |
| Generated | ${escapeTableCell(report.generatedAt)} |
| Merge recommendation | ${escapeTableCell(report.mergeRecommendation)} |
| Blocking findings | ${report.blockingFindingsCount} |
| Checklist findings | ${report.checklistFindingsCount} |
| Code risk | ${renderRiskLabel(report.codeRisk)} |
| Release checklist risk | ${renderRiskLabel(report.releaseChecklistRisk)} |
| Overall/combined risk | ${renderRiskLabel(report.overallRisk)} |
| Risk score | ${report.riskScore}/100 |
| Risk reason | ${escapeTableCell(report.riskReason)} |
| Changed files | ${report.changedFiles.length} |
| External scanner findings | ${report.enterpriseRiskCorrelation.externalFindings.length} |
| Multi-tool correlations | ${report.enterpriseRiskCorrelation.correlatedFindings.filter((finding) => finding.confidence === "multi-tool").length} |
| Required deploy actions | ${report.requiredDeployActions.length} |
| Actionable guidance items | ${report.actionableGuidance.length} |
| Accepted findings | ${report.acceptedFindings.length} |

${renderDecisionSummary(report)}

## Findings

- QA: ${report.qaFindings.length}
- Release: ${report.releaseFindings.length}
- Security: ${report.securityFindings.length}
- Workflow: ${report.workflowFindings.length}
- External scanners: ${report.enterpriseRiskCorrelation.externalFindings.length}

${renderScoreBreakdownSection(report)}

## Required Deploy Actions

${renderShortTaskList(report.requiredDeployActions, "No deploy-specific required actions.")}

${renderGuidanceSection(report)}

## Notes

- Run with ${"`"}--full-report${"`"} for changed files, detailed findings, accepted findings, and suggested tests.
${renderWarnings(report.warnings)}
`;
}

function renderShortTaskList(items: string[], emptyText = "No required actions."): string {
  if (items.length === 0) {
    return emptyText;
  }

  const visibleItems = items.slice(0, 5).map((item) => `- [ ] ${item}`);
  const hiddenCount = items.length - visibleItems.length;

  if (hiddenCount === 0) {
    return visibleItems.join("\n");
  }

  return [...visibleItems, `- ${hiddenCount} more action(s) in the full report.`].join("\n");
}

function renderScoreBreakdownSection(report: GuardianReport): string {
  if (report.overallRisk !== "high" && report.overallRisk !== "critical") {
    return "";
  }

  const breakdown = report.scoreBreakdown;
  const floor = breakdown.criticalFloorApplied;
  const floorText = floor?.applied === true ? ` Critical floor: ${floor.floor}/100 (${floor.reason}).` : "";

  return `## Score Breakdown

Band: **${breakdown.selectedBand}** (${breakdown.bandBase}-${breakdown.bandMax}, factor ${breakdown.bandFactor}). Weighted signal: **${breakdown.weightedSignal}**.${floorText}

Contributors: changed files ${breakdown.changedFileScore}, QA ${breakdown.qaFindingScore}, release ${breakdown.releaseFindingScore}, security ${breakdown.securityFindingScore}, workflow ${breakdown.workflowFindingScore}, external ${breakdown.externalFindingScore}, correlations ${breakdown.correlatedFindingScore}.`;
}

function renderGuidanceSection(report: GuardianReport): string {
  if (report.overallRisk !== "high" && report.overallRisk !== "critical") {
    return "";
  }

  return `## Actionable Guidance

${renderShortGuidanceList(report)}`;
}

function renderDecisionSummary(report: GuardianReport): string {
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
    return lowercaseFirst(floorReason);
  }

  return `${report.blockingFindingsCount} blocking code/test/security finding(s) require review`;
}

function renderShortGuidanceList(report: GuardianReport): string {
  if (report.actionableGuidance.length === 0) {
    return "No actionable guidance.";
  }

  const visibleItems = report.actionableGuidance.slice(0, 5).map((item) => `- [ ] **${item.riskLevel}** ${item.area}: ${item.action}`);
  const hiddenCount = report.actionableGuidance.length - visibleItems.length;

  if (hiddenCount === 0) {
    return visibleItems.join("\n");
  }

  return [...visibleItems, `- ${hiddenCount} more guidance item(s) in the full report.`].join("\n");
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return "";
  }

  return warnings.map((warning) => `- ${warning}`).join("\n");
}

function renderRiskLabel(riskLevel: RiskLevel): string {
  return `**${riskLevel}**`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function lowercaseFirst(value: string): string {
  return value.length === 0 ? value : `${value[0].toLowerCase()}${value.slice(1)}`;
}
