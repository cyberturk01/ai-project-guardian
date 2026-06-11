import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GuardianReport } from "../src/core/types.js";
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
    assert.match(actual, /\| Overall risk \| \*\*high\*\* \|/);
    assert.match(actual, /\| Active findings \| 3 \|/);
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
});

function makeReport(): GuardianReport {
  return {
    projectName: "AI Restaurants",
    generatedAt: "2026-06-10T12:00:00.000Z",
    riskScore: 72,
    overallRisk: "high",
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
    requiredActions: [
      "Review workflow triggers, permissions, environments, and secrets usage.",
      "Confirm required checks still run before deployment."
    ],
    warnings: ["guardian.config.json was not found; using safe defaults."]
  };
}

function readSnapshot(fileName: string): string {
  const compiledTestDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(compiledTestDir, "../../tests/__snapshots__", fileName), "utf8");
}
