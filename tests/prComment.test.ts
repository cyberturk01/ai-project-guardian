import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GuardianReport, RiskLevel } from "../src/core/types.js";
import { renderPrComment } from "../src/renderers/prComment.js";

describe("renderPrComment", () => {
  it("renders a concise pull request summary", () => {
    const actual = renderPrComment(makeReport());

    assert.equal(
      actual,
      `AI Project Guardian

Risk: HIGH

Summary:
- 2 release findings
- 1 QA finding
- 0 security findings
- 0 workflow findings

Top Findings:
- GitHub Actions changed
- Missing integration test
- Package dependency changed

Required Actions:
- Validate workflow triggers
- Add integration coverage
- Review dependency lockfile changes
`
    );
  });

  it("prioritizes critical and high findings before lower risk findings", () => {
    const actual = renderPrComment({
      ...makeReport(),
      overallRisk: "critical",
      qaFindings: [
        qaFinding("Low priority QA note", "low"),
        qaFinding("Critical missing regression coverage", "critical")
      ],
      releaseFindings: [releaseFinding("Medium release note", "medium"), releaseFinding("High deploy risk", "high")]
    });

    const topFindings = actual.slice(actual.indexOf("Top Findings:"));

    assert.match(topFindings, /- Critical missing regression coverage\n- High deploy risk\n- Medium release note\n- Low priority QA note/);
  });

  it("keeps the comment within 30 lines", () => {
    const report = makeReport();
    report.releaseFindings = Array.from({ length: 12 }, (_, index) =>
      releaseFinding(`Release finding ${index + 1}`, index === 0 ? "critical" : "high")
    );
    report.qaFindings = Array.from({ length: 12 }, (_, index) => qaFinding(`QA finding ${index + 1}`, "high"));
    report.securityFindings = Array.from({ length: 12 }, (_, index) => securityFinding(`Security finding ${index + 1}`, "high"));
    report.requiredActions = Array.from({ length: 12 }, (_, index) => `Required action ${index + 1}`);

    const lines = renderPrComment(report).trimEnd().split("\n");

    assert.ok(lines.length <= 30);
  });
});

function makeReport(): GuardianReport {
  return {
    projectName: "AI Restaurants",
    generatedAt: "2026-06-10T12:00:00.000Z",
    riskScore: 72,
    overallRisk: "high",
    changedFiles: [],
    qaFindings: [qaFinding("Missing integration test", "high", ["Add integration coverage"])],
    releaseFindings: [
      releaseFinding("GitHub Actions changed", "high", ["Validate workflow triggers"]),
      releaseFinding("Package dependency changed", "medium", ["Review dependency lockfile changes"])
    ],
    securityFindings: [],
    workflowFindings: [],
    acceptedFindings: [],
    requiredActions: [],
    warnings: []
  };
}

function qaFinding(title: string, riskLevel: RiskLevel, suggestedTests = [`Test ${title}`]): GuardianReport["qaFindings"][number] {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "qa",
    title,
    description: `${title}.`,
    riskLevel,
    affectedFiles: ["src/example.ts"],
    suggestedTests
  };
}

function releaseFinding(
  title: string,
  riskLevel: RiskLevel,
  requiredBeforeDeploy = [`Review ${title}`]
): GuardianReport["releaseFindings"][number] {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "release",
    title,
    description: `${title}.`,
    riskLevel,
    affectedFiles: ["src/example.ts"],
    whyItMatters: `${title} can affect release safety.`,
    requiredBeforeDeploy
  };
}

function securityFinding(title: string, riskLevel: RiskLevel): GuardianReport["securityFindings"][number] {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "security",
    title,
    description: `${title}.`,
    riskLevel,
    filePath: "src/example.ts",
    recommendation: `Review ${title}`
  };
}
