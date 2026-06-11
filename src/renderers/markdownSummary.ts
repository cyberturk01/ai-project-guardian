import type { GuardianReport, RiskLevel } from "../core/types.js";

export function renderMarkdownSummary(report: GuardianReport): string {
  const activeFindings =
    report.qaFindings.length +
    report.releaseFindings.length +
    report.securityFindings.length +
    report.workflowFindings.length +
    report.enterpriseRiskCorrelation.externalFindings.length;

  return `# AI Project Guardian Summary

| Field | Value |
| --- | --- |
| Project | ${escapeTableCell(report.projectName)} |
| Generated | ${escapeTableCell(report.generatedAt)} |
| Overall risk | ${renderRiskLabel(report.overallRisk)} |
| Risk score | ${report.riskScore}/100 |
| Changed files | ${report.changedFiles.length} |
| Active findings | ${activeFindings} |
| External scanner findings | ${report.enterpriseRiskCorrelation.externalFindings.length} |
| Multi-tool correlations | ${report.enterpriseRiskCorrelation.correlatedFindings.filter((finding) => finding.confidence === "multi-tool").length} |
| Required actions | ${report.requiredActions.length} |
| Accepted findings | ${report.acceptedFindings.length} |

## Findings

- QA: ${report.qaFindings.length}
- Release: ${report.releaseFindings.length}
- Security: ${report.securityFindings.length}
- Workflow: ${report.workflowFindings.length}
- External scanners: ${report.enterpriseRiskCorrelation.externalFindings.length}

## Required Actions

${renderShortTaskList(report.requiredActions)}

## Notes

- Run with ${"`"}--full-report${"`"} for changed files, detailed findings, accepted findings, and suggested tests.
${renderWarnings(report.warnings)}
`;
}

function renderShortTaskList(items: string[]): string {
  if (items.length === 0) {
    return "No required actions.";
  }

  const visibleItems = items.slice(0, 5).map((item) => `- [ ] ${item}`);
  const hiddenCount = items.length - visibleItems.length;

  if (hiddenCount === 0) {
    return visibleItems.join("\n");
  }

  return [...visibleItems, `- ${hiddenCount} more action(s) in the full report.`].join("\n");
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
