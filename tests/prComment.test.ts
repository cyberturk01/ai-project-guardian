import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildActionableGuidance, buildRequiredDeployActions } from "../src/core/actionableGuidance.js";
import type { GuardianReport, RiskLevel } from "../src/core/types.js";
import { renderPrComment } from "../src/renderers/prComment.js";

describe("renderPrComment", () => {
  it("renders a concise pull request summary", () => {
    const actual = renderPrComment(makeReport());

    assert.equal(
      actual,
      `### AI Project Guardian

| Metric | Value |
| --- | --- |
| Risk score | 72/100 |
| Overall risk | **high** |

**Summary**

- 0 changed files
- 3 active findings
- 2 required deploy actions
- 3 actionable guidance items
- Score band: source, signal 21

**Top Findings**

- **high** release: GitHub Actions changed (src/example.ts)
- **high** qa: Missing integration test (src/example.ts)
- **medium** release: Package dependency changed (src/example.ts)

**Actionable Guidance**

- [ ] **high** release: Validate workflow triggers
- [ ] **high** qa: Add integration coverage
- [ ] **medium** release: Review dependency lockfile changes
**Required Deploy Actions**

- [ ] Validate workflow triggers
- [ ] Review dependency lockfile changes
`
    );
  });

  it("renders markdown suitable for GitHub PR comments", () => {
    const actual = renderPrComment(makeReport());

    assert.match(actual, /^### AI Project Guardian/);
    assert.match(actual, /\| Risk score \| 72\/100 \|/);
    assert.match(actual, /\| Overall risk \| \*\*high\*\* \|/);
    assert.match(actual, /\*\*Top Findings\*\*/);
    assert.match(actual, /\*\*Required Deploy Actions\*\*/);
    assert.match(actual, /\*\*Actionable Guidance\*\*/);
    assert.match(actual, /- \[ \] Validate workflow triggers/);
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

    const topFindings = actual.slice(actual.indexOf("**Top Findings**"));

    assert.match(
      topFindings,
      /- \*\*critical\*\* qa: Critical missing regression coverage.*\n- \*\*high\*\* release: High deploy risk.*\n- \*\*medium\*\* release: Medium release note.*\n- \*\*low\*\* qa: Low priority QA note/
    );
  });

  it("keeps the comment within 30 lines", () => {
    const report = makeReport();
    report.releaseFindings = Array.from({ length: 12 }, (_, index) =>
      releaseFinding(`Release finding ${index + 1}`, index === 0 ? "critical" : "high")
    );
    report.qaFindings = Array.from({ length: 12 }, (_, index) => qaFinding(`QA finding ${index + 1}`, "high"));
    report.securityFindings = Array.from({ length: 12 }, (_, index) => securityFinding(`Security finding ${index + 1}`, "high"));
    report.requiredDeployActions = Array.from({ length: 12 }, (_, index) => `Required action ${index + 1}`);
    report.actionableGuidance = buildActionableGuidance([
      ...report.releaseFindings,
      ...report.qaFindings,
      ...report.securityFindings,
      ...report.workflowFindings
    ]);
    report.requiredActions = report.requiredDeployActions;

    const lines = renderPrComment(report).trimEnd().split("\n");

    assert.ok(lines.length <= 30);
  });
});

function makeReport(): GuardianReport {
  const report: GuardianReport = {
    projectName: "AI Restaurants",
    generatedAt: "2026-06-10T12:00:00.000Z",
    riskScore: 72,
    overallRisk: "high",
    scoreBreakdown: {
      selectedBand: "source",
      bandBase: 32,
      bandMax: 60,
      bandFactor: 2,
      weightedSignal: 21,
      changedFileScore: 0,
      qaFindingScore: 8,
      releaseFindingScore: 13,
      securityFindingScore: 0,
      workflowFindingScore: 0,
      externalFindingScore: 0,
      correlatedFindingScore: 0,
      criticalFloorApplied: { applied: false }
    },
    changedFiles: [],
    qaFindings: [qaFinding("Missing integration test", "high", ["Add integration coverage"])],
    releaseFindings: [
      releaseFinding("GitHub Actions changed", "high", ["Validate workflow triggers"]),
      releaseFinding("Package dependency changed", "medium", ["Review dependency lockfile changes"])
    ],
    securityFindings: [],
    workflowFindings: [],
    enterpriseRiskCorrelation: {
      externalFindings: [],
      correlatedFindings: [],
      importedArtifacts: [],
      warnings: []
    },
    acceptedFindings: [],
    requiredDeployActions: [],
    actionableGuidance: [],
    requiredActions: [],
    warnings: []
  };

  report.requiredDeployActions = buildRequiredDeployActions(report.releaseFindings);
  report.actionableGuidance = buildActionableGuidance([
    ...report.releaseFindings,
    ...report.qaFindings,
    ...report.securityFindings,
    ...report.workflowFindings
  ]);
  report.requiredActions = report.requiredDeployActions;

  return report;
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
