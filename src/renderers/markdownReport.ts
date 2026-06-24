import { basename } from "node:path";
import type { ChangedFile, EvidenceGroup, GuardianReport, RelatedTestSignal, RiskLevel } from "../core/types.js";
import { renderDecisionSummary } from "./decisionSummary.js";
import { buildMarkdownNotes } from "./markdownNotes.js";

export function renderMarkdownReport(report: GuardianReport): string {
  return `${renderHeader(report)}

## Executive Summary

${renderExecutiveSummary(report)}

## Overall Risk

${renderOverallRisk(report)}

## Score Breakdown

${renderScoreBreakdown(report)}

## Changed Files

${renderChangedFiles(report.changedFiles)}${renderSuggestedReview(report)}

## Blocking Findings

${renderBlockingFindings(report)}

## Review Findings

${renderReviewFindings(report)}

## Advisory Findings

${renderAdvisoryFindings(report)}

## Release Checklist

${renderReleaseFindings(report.releaseFindings)}

## Enterprise Risk Correlation

${renderEnterpriseRiskCorrelation(report)}

## Accepted Findings

${renderAcceptedFindings(report.acceptedFindings)}

## Required Deploy Actions

${renderTaskList(report.requiredDeployActions, "No deploy-specific required actions.")}

## Actionable Guidance

${renderActionableGuidance(report)}

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
  const highestRisk = highestRiskLevel([
    report.overallRisk,
    ...report.changedFiles.map((file) => file.riskLevel),
    ...report.qaFindings.map((finding) => finding.riskLevel),
    ...report.releaseFindings.map((finding) => finding.riskLevel),
    ...report.securityFindings.map((finding) => finding.riskLevel),
    ...report.workflowFindings.map((finding) => finding.riskLevel),
    ...report.enterpriseRiskCorrelation.externalFindings.map((finding) => finding.riskLevel),
    ...report.enterpriseRiskCorrelation.correlatedFindings.map((finding) => finding.riskLevel)
  ]);

  return `| Metric | Count |
| --- | ---: |
| Changed files | ${report.changedFiles.length} |
| Blocking findings | ${report.blockingFindingsCount} |
| Release checklist findings | ${report.checklistFindingsCount} |
| QA findings | ${report.qaFindings.length} |
| Release findings | ${report.releaseFindings.length} |
| Security findings | ${report.securityFindings.length} |
| Workflow findings | ${report.workflowFindings.length} |
| External scanner findings | ${report.enterpriseRiskCorrelation.externalFindings.length} |
| Multi-tool correlations | ${report.enterpriseRiskCorrelation.correlatedFindings.filter((finding) => finding.confidence === "multi-tool").length} |
| Accepted findings | ${report.acceptedFindings.length} |
| Required deploy actions | ${report.requiredDeployActions.length} |
| Actionable guidance items | ${report.actionableGuidance.length} |

| Decision field | Value |
| --- | --- |
| Merge recommendation | ${escapeTableCell(report.mergeRecommendation)} |
| Code risk | ${renderRiskLabel(report.codeRisk)} |
| Release checklist risk | ${renderRiskLabel(report.releaseChecklistRisk)} |
| Overall/combined risk | ${renderRiskLabel(report.overallRisk)} |
| Risk reason | ${escapeTableCell(report.riskReason)} |

${renderDecisionSummary(report)}

Highest detected risk: **${highestRisk}**.`;
}

function renderOverallRisk(report: GuardianReport): string {
  return `${renderRiskLabel(report.overallRisk)} with score **${report.riskScore}/100**.

${riskGuidance(report.overallRisk)}`;
}

function renderScoreBreakdown(report: GuardianReport): string {
  const breakdown = report.scoreBreakdown;
  const floor = breakdown.criticalFloorApplied;
  const criticalFloorText =
    floor === undefined || !floor.applied
      ? "No"
      : `Yes (${floor.floor}/100: ${floor.reason})`;

  return `| Component | Value |
| --- | ---: |
| Selected band | ${escapeTableCell(breakdown.selectedBand)} |
| Band base | ${breakdown.bandBase} |
| Band max | ${breakdown.bandMax} |
| Band factor | ${breakdown.bandFactor} |
| Weighted signal | ${breakdown.weightedSignal} |
| Changed files | ${breakdown.changedFileScore} |
| QA findings | ${breakdown.qaFindingScore} |
| Release findings | ${breakdown.releaseFindingScore} |
| Security findings | ${breakdown.securityFindingScore} |
| Workflow findings | ${breakdown.workflowFindingScore} |
| External scanner findings | ${breakdown.externalFindingScore} |
| Multi-tool correlations | ${breakdown.correlatedFindingScore} |
| Critical floor applied | ${criticalFloorText} |`;
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

function renderSuggestedReview(report: GuardianReport): string {
  const suggestions = uniqueInOrder(report.suggestedReview ?? []);

  if (suggestions.length === 0) {
    return "";
  }

  return `

Suggested review:

${renderList(suggestions)}`;
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
${renderConfidenceRow(finding.confidence)}| Affected files | ${renderInlineList(finding.affectedFiles)} |

${finding.description}${renderQaEvidence(finding)}

**Suggested tests**

${renderList(finding.suggestedTests)}`;
    })
    .join("\n\n");
}

function renderQaEvidence(finding: GuardianReport["qaFindings"][number]): string {
  const evidence = finding.testSignalEvidence;

  if (evidence === undefined) {
    return "";
  }

  return `

**Test signal evidence**

${renderEvidenceGroups(evidence)}

${evidence.reason}
`;
}

function renderEvidenceGroups(evidence: NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>): string {
  if (evidence.evidenceGroups !== undefined && evidence.evidenceGroups.length > 0) {
    return evidence.evidenceGroups.map(renderEvidenceGroup).join("\n\n");
  }

  return `${renderFlatQaEvidence(evidence)}
`;
}

function renderEvidenceGroup(group: EvidenceGroup): string {
  const suggestedReview =
    group.suggestedReview.length === 0
      ? ""
      : `

Suggested review:
${renderList(group.suggestedReview)}`;

  return `QA Evidence Group: ${group.name}

Changed files:
${renderBaseNameList(group.changedFiles)}

Detected tests:
${renderBaseNameList(group.detectedTests)}

Detected coverage signals:
${renderCoverageSignalList(group.detectedCoverageSignals)}${suggestedReview}`;
}

function renderFlatQaEvidence(evidence: NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>): string {
  return `Changed files:
${renderPathList(evidence.changedFiles)}

Expected test signals:
${renderPathList(evidence.expectedTestSignals)}

Detected related tests:
${renderRelatedTests(evidence.detectedRelatedTests)}
${renderCoverageSignals(evidence)}

Suggested coverage to review:
${renderList(evidence.suggestedCoverage)}
`;
}

function renderCoverageSignals(evidence: NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>): string {
  if (evidence.detectedCoverageSignals.length === 0 && evidence.unconfirmedCoverageSignals.length === 0) {
    return "";
  }

  return `

Heuristic coverage signals:
${renderCoverageSignalList(evidence.detectedCoverageSignals)}

Coverage signals still needing review:
${renderCoverageSignalList(evidence.unconfirmedCoverageSignals)}`;
}

function renderCoverageSignalList(signals: NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>["detectedCoverageSignals"]): string {
  if (signals.length === 0) {
    return "- None";
  }

  return signals.map((signal) => `- ${coverageSignalLabel(signal)}`).join("\n");
}

function coverageSignalLabel(signal: NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>["detectedCoverageSignals"][number]): string {
  return signal.replaceAll("_", " ");
}

function renderRelatedTests(tests: RelatedTestSignal[]): string {
  if (tests.length === 0) {
    return "- None";
  }

  return tests.map((test) => `- ${test.path} (${test.score})`).join("\n");
}

function renderBlockingFindings(report: GuardianReport): string {
  const blockingQaFindings = report.qaFindings.filter(isBlockingQaFinding);
  const blockingSecurityFindings = report.securityFindings.filter(isBlockingSecurityFinding);
  const sections = renderFindingSections([
    ["QA Findings", renderQaFindings(blockingQaFindings), blockingQaFindings.length],
    ["Security Findings", renderSecurityFindings(blockingSecurityFindings), blockingSecurityFindings.length]
  ]);

  return sections === "" ? "No blocking findings." : sections;
}

function renderReviewFindings(report: GuardianReport): string {
  const reviewQaFindings = report.qaFindings.filter((finding) => !isBlockingQaFinding(finding));
  const reviewSecurityFindings = report.securityFindings.filter(isReviewSecurityFinding);
  const reviewWorkflowFindings = report.workflowFindings;
  const sections = renderFindingSections([
    ["QA Findings", renderQaFindings(reviewQaFindings), reviewQaFindings.length],
    ["Security Findings", renderSecurityFindings(reviewSecurityFindings), reviewSecurityFindings.length],
    ["Workflow Findings", renderWorkflowFindings(reviewWorkflowFindings), reviewWorkflowFindings.length]
  ]);

  return sections === "" ? "No review findings." : sections;
}

function renderAdvisoryFindings(report: GuardianReport): string {
  const advisorySecurityFindings = report.securityFindings.filter(isAdvisorySecurityFinding);
  const sections = renderFindingSections([
    ["Security Findings", renderSecurityFindings(advisorySecurityFindings), advisorySecurityFindings.length]
  ]);

  return sections === "" ? "No advisory findings." : sections;
}

function renderFindingSections(sections: Array<[title: string, body: string, count: number]>): string {
  return sections
    .filter(([, , count]) => count > 0)
    .map(([title, body]) => `### ${title}\n\n${body}`)
    .join("\n\n");
}

function isBlockingQaFinding(finding: GuardianReport["qaFindings"][number]): boolean {
  return (
    finding.id === "qa-auth-security-without-negative-test" &&
    (finding.confidence ?? 0) >= 50 &&
    (finding.testSignalEvidence?.detectedRelatedTests.length ?? 0) === 0
  );
}

function isBlockingSecurityFinding(finding: GuardianReport["securityFindings"][number]): boolean {
  return finding.blocking !== false && (finding.riskLevel === "high" || finding.riskLevel === "critical");
}

function isReviewSecurityFinding(finding: GuardianReport["securityFindings"][number]): boolean {
  return finding.blocking === false && (finding.riskLevel === "high" || finding.riskLevel === "critical");
}

function isAdvisorySecurityFinding(finding: GuardianReport["securityFindings"][number]): boolean {
  return !isBlockingSecurityFinding(finding) && !isReviewSecurityFinding(finding);
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
${renderConfidenceRow(finding.confidence)}| Location | ${escapeTableCell(location)} |

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

function renderConfidenceRow(confidence: number | undefined): string {
  if (confidence === undefined) {
    return "";
  }

  return `| Confidence | ${confidence}% (${confidenceBand(confidence)}) |\n`;
}

function confidenceBand(confidence: number): string {
  if (confidence >= 80) {
    return "high confidence";
  }

  if (confidence >= 50) {
    return "moderate confidence";
  }

  return "low confidence";
}

function renderEnterpriseRiskCorrelation(report: GuardianReport): string {
  const correlation = report.enterpriseRiskCorrelation;

  if (correlation.importedArtifacts.length === 0) {
    return "No external scanner artifacts imported.";
  }

  const importedArtifacts = renderList(correlation.importedArtifacts.map((artifactPath) => escapeTableCell(artifactPath)));
  const externalFindings =
    correlation.externalFindings.length === 0
      ? "No external findings imported."
      : `| Source | Rule | Risk | Location | Title |
| --- | --- | --- | --- | --- |
${correlation.externalFindings.map(renderExternalFindingRow).join("\n")}`;
  const correlatedFindings =
    correlation.correlatedFindings.length === 0
      ? "No correlated findings."
      : `| Confidence | Sources | Risk | Location | Title |
| --- | --- | --- | --- | --- |
${correlation.correlatedFindings.map(renderCorrelatedFindingRow).join("\n")}`;

  return `Imported artifacts:

${importedArtifacts}

### Correlated Findings

${correlatedFindings}

### External Findings

${externalFindings}`;
}

function renderExternalFindingRow(finding: GuardianReport["enterpriseRiskCorrelation"]["externalFindings"][number]): string {
  return `| ${escapeTableCell(finding.source)} | ${escapeTableCell(finding.ruleId)} | ${renderRiskLabel(finding.riskLevel)} | ${escapeTableCell(locationText(finding.filePath, finding.lineNumber))} | ${escapeTableCell(finding.title)} |`;
}

function renderCorrelatedFindingRow(finding: GuardianReport["enterpriseRiskCorrelation"]["correlatedFindings"][number]): string {
  return `| ${escapeTableCell(finding.confidence)} | ${escapeTableCell(finding.sources.join(", "))} | ${renderRiskLabel(finding.riskLevel)} | ${escapeTableCell(locationText(finding.filePath, finding.lineNumber))} | ${escapeTableCell(finding.title)} |`;
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

function renderActionableGuidance(report: GuardianReport): string {
  if (report.actionableGuidance.length === 0) {
    return "No actionable guidance.";
  }

  return report.actionableGuidance
    .map((item) => {
      const files = item.affectedFiles === undefined || item.affectedFiles.length === 0 ? "" : ` (${renderInlineList(item.affectedFiles)})`;
      return `- [ ] ${renderRiskLabel(item.riskLevel)} ${item.area}: ${item.action}${files}`;
    })
    .join("\n");
}

function renderNotes(report: GuardianReport): string {
  const notes = buildMarkdownNotes(report, [
    "This report is generated from repository heuristics and should support, not replace, human review."
  ]);

  return renderList(notes);
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "None.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function renderPathList(items: string[]): string {
  if (items.length === 0) {
    return "None.";
  }

  return items.map((item) => `- \`${item}\``).join("\n");
}

function renderBaseNameList(items: string[]): string {
  if (items.length === 0) {
    return "None.";
  }

  return items.map((item) => `- ${basename(item)}`).join("\n");
}

function renderTaskList(items: string[], emptyText = "No required actions."): string {
  if (items.length === 0) {
    return emptyText;
  }

  return items.map((item) => `- [ ] ${item}`).join("\n");
}

function renderInlineList(items: string[]): string {
  if (items.length === 0) {
    return "None";
  }

  return escapeTableCell(items.join(", "));
}

function locationText(filePath: string | undefined, lineNumber: number | undefined): string {
  if (filePath === undefined) {
    return "Repository";
  }

  if (lineNumber === undefined) {
    return filePath;
  }

  return `${filePath}:${lineNumber}`;
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

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
