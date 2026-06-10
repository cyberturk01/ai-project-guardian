import type { ChangedFile, GuardianReport, RiskLevel } from "../core/types.js";

export function renderMarkdownReport(report: GuardianReport): string {
  return `${renderHeader(report)}

## Executive Summary

${renderExecutiveSummary(report)}

## Overall Risk

${renderOverallRisk(report)}

## Changed Files

${renderChangedFiles(report.changedFiles)}

## QA Findings

${renderQaFindings(report.qaFindings)}

## Release Findings

${renderReleaseFindings(report.releaseFindings)}

## Security Findings

${renderSecurityFindings(report.securityFindings)}

## Workflow Findings

${renderWorkflowFindings(report.workflowFindings)}

## Accepted Findings

${renderAcceptedFindings(report.acceptedFindings)}

## Required Actions

${renderTaskList(report.requiredActions)}

## Suggested Tests

${renderSuggestedTests(report)}

## Notes

${renderNotes(report)}
`;
}

function renderHeader(report: GuardianReport): string {
  return `# AI Project Guardian Report

| Field | Value |
| --- | --- |
| Project | ${escapeTableCell(report.projectName)} |
| Generated | ${escapeTableCell(report.generatedAt)} |
| Risk score | ${report.riskScore}/100 |
| Overall risk | ${renderRiskLabel(report.overallRisk)} |`;
}

function renderExecutiveSummary(report: GuardianReport): string {
  const totalFindings =
    report.qaFindings.length + report.releaseFindings.length + report.securityFindings.length + report.workflowFindings.length;
  const highestRisk = highestRiskLevel([
    report.overallRisk,
    ...report.changedFiles.map((file) => file.riskLevel),
    ...report.qaFindings.map((finding) => finding.riskLevel),
    ...report.releaseFindings.map((finding) => finding.riskLevel),
    ...report.securityFindings.map((finding) => finding.riskLevel),
    ...report.workflowFindings.map((finding) => finding.riskLevel)
  ]);

  return `| Metric | Count |
| --- | ---: |
| Changed files | ${report.changedFiles.length} |
| QA findings | ${report.qaFindings.length} |
| Release findings | ${report.releaseFindings.length} |
| Security findings | ${report.securityFindings.length} |
| Workflow findings | ${report.workflowFindings.length} |
| Accepted findings | ${report.acceptedFindings.length} |
| Required actions | ${report.requiredActions.length} |

${renderFindingSummary(totalFindings, report.acceptedFindings.length)}

Highest detected risk: **${highestRisk}**.`;
}

function renderOverallRisk(report: GuardianReport): string {
  return `${renderRiskLabel(report.overallRisk)} with score **${report.riskScore}/100**.

${riskGuidance(report.overallRisk)}`;
}

function renderFindingSummary(activeFindings: number, acceptedFindings: number): string {
  if (activeFindings > 0) {
    return `${activeFindings} finding(s) need review before release.`;
  }

  if (acceptedFindings > 0) {
    return "No new findings need review before release. Accepted findings are listed separately.";
  }

  return "No findings were detected by the current Guardian rules.";
}

function renderChangedFiles(changedFiles: ChangedFile[]): string {
  if (changedFiles.length === 0) {
    return "No changed files detected.";
  }

  const rows = changedFiles.map((file) => {
    const path = file.previousPath === undefined ? file.path : `${file.previousPath} -> ${file.path}`;

    return `| ${escapeTableCell(file.status)} | ${escapeTableCell(path)} | ${escapeTableCell(file.category)} | ${renderRiskLabel(file.riskLevel)} |`;
  });

  return `| Status | Path | Category | Risk |
| --- | --- | --- | --- |
${rows.join("\n")}`;
}

function renderQaFindings(findings: GuardianReport["qaFindings"]): string {
  if (findings.length === 0) {
    return "No QA findings.";
  }

  return findings
    .map((finding) => {
      return `### ${finding.title}

| Field | Value |
| --- | --- |
| Risk | ${renderRiskLabel(finding.riskLevel)} |
| Affected files | ${renderInlineList(finding.affectedFiles)} |

${finding.description}

**Suggested tests**

${renderList(finding.suggestedTests)}`;
    })
    .join("\n\n");
}

function renderReleaseFindings(findings: GuardianReport["releaseFindings"]): string {
  if (findings.length === 0) {
    return "No release findings.";
  }

  return findings
    .map((finding) => {
      return `### ${finding.title}

| Field | Value |
| --- | --- |
| Risk | ${renderRiskLabel(finding.riskLevel)} |
| Affected files | ${renderInlineList(finding.affectedFiles)} |

${finding.description}

**Why it matters:** ${finding.whyItMatters}

**Required before deploy**

${renderTaskList(finding.requiredBeforeDeploy)}`;
    })
    .join("\n\n");
}

function renderSecurityFindings(findings: GuardianReport["securityFindings"]): string {
  if (findings.length === 0) {
    return "No security findings.";
  }

  return findings
    .map((finding) => {
      const location =
        finding.filePath === undefined
          ? "Unknown"
          : finding.lineNumber === undefined
            ? finding.filePath
            : `${finding.filePath}:${finding.lineNumber}`;

      return `### ${finding.title}

| Field | Value |
| --- | --- |
| Risk | ${renderRiskLabel(finding.riskLevel)} |
| Location | ${escapeTableCell(location)} |

${finding.description}

**Recommendation:** ${finding.recommendation ?? "Review this changed file manually."}`;
    })
    .join("\n\n");
}

function renderWorkflowFindings(findings: GuardianReport["workflowFindings"]): string {
  if (findings.length === 0) {
    return "No workflow findings.";
  }

  return findings
    .map((finding) => {
      return `### ${finding.title}

| Field | Value |
| --- | --- |
| Risk | ${renderRiskLabel(finding.riskLevel)} |
| Missing check | ${escapeTableCell(finding.missingCheck)} |
| Workflow file | ${escapeTableCell(finding.workflowFile)} |

${finding.description}

**Recommendation:** ${finding.recommendation ?? "Add the missing check to a required GitHub Actions workflow."}`;
    })
    .join("\n\n");
}

function renderAcceptedFindings(findings: GuardianReport["acceptedFindings"]): string {
  if (findings.length === 0) {
    return "No accepted findings.";
  }

  const rows = findings.map((finding) => {
    const location = finding.filePath ?? ("affectedFiles" in finding ? finding.affectedFiles.join(", ") : "None");

    return `| ${escapeTableCell(finding.area)} | ${escapeTableCell(finding.title)} | ${renderRiskLabel(finding.riskLevel)} | ${escapeTableCell(location)} |`;
  });

  return `These findings matched ${"`"}.guardian-baseline.json${"`"} and are shown for visibility, but they do not contribute to the overall score.

| Type | Title | Risk | Location |
| --- | --- | --- | --- |
${rows.join("\n")}`;
}

function renderSuggestedTests(report: GuardianReport): string {
  const tests = uniqueSorted(report.qaFindings.flatMap((finding) => finding.suggestedTests));

  if (tests.length === 0) {
    return "No additional tests suggested.";
  }

  return renderTaskList(tests);
}

function renderNotes(report: GuardianReport): string {
  const notes = [
    "This report is generated from repository heuristics and should support, not replace, human review.",
    ...report.warnings
  ];

  return renderList(notes);
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "None.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function renderTaskList(items: string[]): string {
  if (items.length === 0) {
    return "No required actions.";
  }

  return items.map((item) => `- [ ] ${item}`).join("\n");
}

function renderInlineList(items: string[]): string {
  if (items.length === 0) {
    return "None";
  }

  return escapeTableCell(items.join(", "));
}

function renderRiskLabel(riskLevel: RiskLevel): string {
  return `**${riskLevel}**`;
}

function riskGuidance(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "critical":
      return "Stop the release until critical findings are resolved or explicitly accepted.";
    case "high":
      return "Review required actions before release and confirm owners for unresolved risk.";
    case "medium":
      return "Review findings and run the suggested tests before merging or deploying.";
    case "low":
      return "Low risk detected. Review notes and keep normal release checks in place.";
    case "info":
      return "Informational risk only. Continue with standard review and CI checks.";
  }
}

function highestRiskLevel(riskLevels: RiskLevel[]): RiskLevel {
  const weights: Record<RiskLevel, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  return riskLevels.reduce<RiskLevel>((highest, current) => (weights[current] > weights[highest] ? current : highest), "info");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
