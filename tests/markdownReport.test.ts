import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildActionableGuidance, buildRequiredDeployActions } from "../src/core/actionableGuidance.js";
import type { GuardianReport, MergeRecommendation } from "../src/core/types.js";
import { renderMarkdownReport } from "../src/renderers/markdownReport.js";
import { renderMarkdownSummary } from "../src/renderers/markdownSummary.js";
import { renderPrComment } from "../src/renderers/prComment.js";
import { renderReport } from "../src/renderers/renderReport.js";

describe("renderMarkdownReport", () => {
  it("matches the GitHub Actions summary snapshot", () => {
    const actual = renderMarkdownReport(makeReport());
    const snapshot = readSnapshot("guardian-report.md");

    assert.equal(actual, snapshot);
  });

  it("is used by the generic markdown report renderer", () => {
    const report = makeReport();

    assert.equal(renderReport(report, "markdown"), renderMarkdownReport(report));
  });

  it("renders the short summary style for GitHub Actions", () => {
    const actual = renderMarkdownSummary(makeReport());

    assert.match(actual, /# AI Project Guardian Summary/);
    assert.match(actual, /\| Overall\/combined risk \| \*\*high\*\* \|/);
    assert.match(actual, /\| Merge recommendation \| blocked \|/);
    assert.match(actual, /\| Blocking findings \| 2 \|/);
    assert.match(actual, /\| Checklist findings \| 1 \|/);
    assert.doesNotMatch(actual, /Active findings/);
    assert.match(actual, /Run with `--full-report`/);
    assert.doesNotMatch(actual, /## Changed Files/);
    assert.doesNotMatch(actual, /src\/api\/reservations\.ts:18/);
  });

  it("uses summary style when requested by the generic renderer", () => {
    const report = makeReport();

    assert.equal(renderReport(report, "markdown", "summary"), renderMarkdownSummary(report));
  });

  it("uses PR comment style when requested by the generic renderer", () => {
    const report = makeReport();

    assert.equal(renderReport(report, "markdown", "pr-comment"), renderPrComment(report));
  });

  it("renders decision wording that matches each merge recommendation state", () => {
    const cases: Array<{
      recommendation: MergeRecommendation;
      blockingFindingsCount: number;
      checklistFindingsCount: number;
      expected: string;
    }> = [
      {
        recommendation: "blocked",
        blockingFindingsCount: 2,
        checklistFindingsCount: 1,
        expected: "Merge blocked because 2 blocking code/test/security finding(s) require attention."
      },
      {
        recommendation: "review_required",
        blockingFindingsCount: 1,
        checklistFindingsCount: 0,
        expected: "Merge requires review because 1 code/test/security finding(s) need attention before merge."
      },
      {
        recommendation: "safe_after_checklist",
        blockingFindingsCount: 0,
        checklistFindingsCount: 2,
        expected: "Merge is safe after completing the remaining release checklist items."
      },
      {
        recommendation: "safe",
        blockingFindingsCount: 0,
        checklistFindingsCount: 0,
        expected: "No blocking findings remain. Merge is considered safe."
      }
    ];

    for (const testCase of cases) {
      const report = makeReportForRecommendation(testCase);

      assert.match(renderMarkdownSummary(report), new RegExp(escapeRegExp(testCase.expected)));
      assert.match(renderMarkdownReport(report), new RegExp(escapeRegExp(testCase.expected)));
      assert.match(renderPrComment(report), new RegExp(`- ${escapeRegExp(testCase.expected)}`));
    }
  });

  it("uses review_required wording that starts with Merge requires review", () => {
    const report = makeReportForRecommendation({
      recommendation: "review_required",
      blockingFindingsCount: 1,
      checklistFindingsCount: 0
    });

    assert.match(renderMarkdownSummary(report), /Merge requires review because 1 code\/test\/security finding\(s\) need attention before merge\./);
  });
});

function makeReport(): GuardianReport {
  const report: GuardianReport = {
    projectName: "AI Restaurants",
    generatedAt: "2026-06-10T12:00:00.000Z",
    riskScore: 72,
    overallRisk: "high",
    blockingFindingsCount: 2,
    checklistFindingsCount: 1,
    mergeRecommendation: "blocked",
    codeRisk: "high",
    releaseChecklistRisk: "high",
    riskReason: "Security findings require review.",
    scoreBreakdown: {
      selectedBand: "security",
      bandBase: 70,
      bandMax: 100,
      bandFactor: 2,
      weightedSignal: 52,
      changedFileScore: 18,
      qaFindingScore: 8,
      releaseFindingScore: 8,
      securityFindingScore: 18,
      workflowFindingScore: 0,
      externalFindingScore: 0,
      correlatedFindingScore: 0,
      criticalFloorApplied: { applied: false }
    },
    changedFiles: [
      {
        path: "src/api/reservations.ts",
        status: "modified",
        category: "source",
        riskLevel: "high"
      },
      {
        path: "tests/reservations.test.ts",
        status: "added",
        category: "test",
        riskLevel: "low"
      },
      {
        path: ".github/workflows/release.yml",
        previousPath: ".github/workflows/deploy.yml",
        status: "renamed",
        category: "ci",
        riskLevel: "medium"
      }
    ],
    qaFindings: [
      {
        id: "qa-api-without-integration-test",
        area: "qa",
        title: "Route or API changed without API/integration test coverage",
        description: "A route, controller, handler, or API file changed without a matching API or integration test.",
        riskLevel: "high",
        affectedFiles: ["src/api/reservations.ts"],
        suggestedTests: ["Add an API or integration test that exercises src/api/reservations.ts."]
      }
    ],
    releaseFindings: [
      {
        id: "release-github-actions-changed",
        area: "release",
        title: "GitHub Actions changed",
        description: "A GitHub Actions workflow or local action changed.",
        riskLevel: "high",
        affectedFiles: [".github/workflows/release.yml"],
        whyItMatters: "CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.",
        requiredBeforeDeploy: [
          "Review workflow triggers, permissions, environments, and secrets usage.",
          "Confirm required checks still run before deployment."
        ]
      }
    ],
    securityFindings: [
      {
        id: "security-hardcoded-secret",
        area: "security",
        title: "Possible hardcoded secret",
        description: "Possible hardcoded secret detected in a changed file. This is a possible risk based on heuristic matching, not a confirmed vulnerability.",
        riskLevel: "high",
        filePath: "src/api/reservations.ts",
        lineNumber: 18,
        recommendation: "Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real."
      }
    ],
    workflowFindings: [],
    enterpriseRiskCorrelation: {
      externalFindings: [],
      correlatedFindings: [],
      importedArtifacts: [],
      warnings: []
    },
    acceptedFindings: [
      {
        id: "release-github-actions-changed",
        area: "release",
        title: "GitHub Actions changed",
        description: "A GitHub Actions workflow or local action changed.",
        riskLevel: "high",
        affectedFiles: [".github/workflows/release.yml"],
        whyItMatters: "CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.",
        requiredBeforeDeploy: ["Review workflow triggers, permissions, environments, and secrets usage."],
        accepted: true
      }
    ],
    requiredDeployActions: [
      "Review workflow triggers, permissions, environments, and secrets usage.",
      "Confirm required checks still run before deployment."
    ],
    actionableGuidance: [],
    requiredActions: [
      "Review workflow triggers, permissions, environments, and secrets usage.",
      "Confirm required checks still run before deployment."
    ],
    warnings: ["guardian.config.json was not found; using safe defaults."]
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

function readSnapshot(fileName: string): string {
  const compiledTestDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(compiledTestDir, "../../tests/__snapshots__", fileName), "utf8");
}

function makeReportForRecommendation(options: {
  recommendation: MergeRecommendation;
  blockingFindingsCount: number;
  checklistFindingsCount: number;
}): GuardianReport {
  return {
    ...makeReport(),
    mergeRecommendation: options.recommendation,
    blockingFindingsCount: options.blockingFindingsCount,
    checklistFindingsCount: options.checklistFindingsCount
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
