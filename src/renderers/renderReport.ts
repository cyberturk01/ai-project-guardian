import type { ReportFormat } from "../config/loadConfig.js";
import type { GuardianReport } from "../core/types.js";

export function renderReport(report: GuardianReport, format: ReportFormat): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  return `# AI Project Guardian Report

- Project: ${report.projectName}
- Generated: ${report.generatedAt}
- Risk score: ${report.riskScore}/100
- Overall risk: ${report.overallRisk}

## Changed files

${renderChangedFiles(report.changedFiles)}

## QA findings

${renderQaFindings(report.qaFindings)}

## Release findings

${renderReleaseFindings(report.releaseFindings)}

## Security findings

${renderSecurityFindings(report.securityFindings)}

## Required actions

${renderList(report.requiredActions)}

## Warnings

${renderList(report.warnings)}
`;
}

function renderCount(count: number): string {
  return count === 0 ? "None." : `${count} item(s).`;
}

function renderChangedFiles(changedFiles: GuardianReport["changedFiles"]): string {
  if (changedFiles.length === 0) {
    return "None.";
  }

  return changedFiles
    .map((file) => {
      const renameDetail = file.previousPath === undefined ? "" : ` from ${file.previousPath}`;
      return `- ${file.status}: ${file.path}${renameDetail}`;
    })
    .join("\n");
}

function renderQaFindings(findings: GuardianReport["qaFindings"]): string {
  if (findings.length === 0) {
    return "None.";
  }

  return findings
    .map((finding) => {
      return `### ${finding.title}

- Risk: ${finding.riskLevel}
- Affected files: ${finding.affectedFiles.join(", ")}
- Suggested tests: ${finding.suggestedTests.join(" ")}

${finding.description}`;
    })
    .join("\n\n");
}

function renderReleaseFindings(findings: GuardianReport["releaseFindings"]): string {
  if (findings.length === 0) {
    return "None.";
  }

  return findings
    .map((finding) => {
      return `### ${finding.title}

- Risk: ${finding.riskLevel}
- Affected files: ${finding.affectedFiles.join(", ")}
- Why it matters: ${finding.whyItMatters}
- Required before deploy: ${finding.requiredBeforeDeploy.join(" ")}

${finding.description}`;
    })
    .join("\n\n");
}

function renderSecurityFindings(findings: GuardianReport["securityFindings"]): string {
  if (findings.length === 0) {
    return "None.";
  }

  return findings
    .map((finding) => {
      const location = finding.lineNumber === undefined ? finding.filePath : `${finding.filePath}:${finding.lineNumber}`;

      return `### ${finding.title}

- Risk: ${finding.riskLevel}
- Location: ${location ?? "Unknown"}
- Recommendation: ${finding.recommendation ?? "Review this changed file manually."}

${finding.description}`;
    })
    .join("\n\n");
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "None.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
