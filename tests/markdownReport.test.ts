import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildActionableGuidance, buildRequiredDeployActions } from "../src/core/actionableGuidance.js";
import type { GuardianReport, MergeRecommendation } from "../src/core/types.js";
import { renderMarkdownReport } from "../src/renderers/markdownReport.js";
import { renderMarkdownSummary } from "../src/renderers/markdownSummary.js";
import {
  missingConfigOnboardingNote,
  missingProjectBrainOnboardingNote
} from "../src/renderers/onboardingGuidance.js";
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
    assert.doesNotMatch(actual, /## Blocking Findings/);
    assert.match(actual, /Run with `--full-report`/);
    assert.doesNotMatch(actual, /## Changed Files/);
    assert.doesNotMatch(actual, /src\/api\/reservations\.ts:18/);
  });

  it("renders fixture secret findings without overclaiming a production leak", () => {
    const report = makeReport();
    report.securityFindings = [
      {
        id: "security-hardcoded-secret",
        area: "security",
        title: "Possible hardcoded secret",
        description: "Possible test fixture secret detected. Review if this is real; not treated as a confirmed production leak.",
        riskLevel: "low",
        confidence: 42,
        filePath: "tests/auth/sessionFixture.test.ts",
        lineNumber: 7,
        blocking: false,
        fixture_like: true,
        recommendation: "Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real."
      }
    ];

    const fullReport = renderMarkdownReport(report);

    assert.match(fullReport, /Possible test fixture secret detected\. Review if this is real; not treated as a confirmed production leak\./);
    assert.doesNotMatch(fullReport, /secret leaked|production secret exposed|critical leak/i);
  });

  it("renders QA test signal evidence in full and summary Markdown reports", () => {
    const report = makeReport();
    report.qaFindings = [
      {
        ...report.qaFindings[0],
        title: "Source change without related test signal",
        affectedFiles: ["src/referral/rewardService.ts", "src/referral/rewardRules.ts"],
        suggestedTests: ["Review related referral test coverage."],
        confidence: 84,
        testSignalEvidence: {
          changedFiles: ["src/referral/rewardRules.ts", "src/referral/rewardService.ts"],
          expectedTestSignals: ["src/referral/*.test.ts", "src/referral/*.spec.ts", "tests/referral/*"],
          detectedTestChanges: ["tests/referral/rewardRules.test.ts", "tests/outputContract.test.ts"],
          detectedRelatedTests: [
            { path: "tests/referral/rewardRules.test.ts", score: "strong" },
            { path: "tests/outputContract.test.ts", score: "medium" }
          ],
          detectedCoverageSignals: ["regression", "output_contract"],
          unconfirmedCoverageSignals: ["negative_path"],
          suggestedCoverage: ["happy path", "duplicate/abuse prevention", "limit/quota boundary"],
          reason: "Related test changes were detected; review whether they cover the changed behavior."
        }
      }
    ];
    report.actionableGuidance = buildActionableGuidance([
      ...report.releaseFindings,
      ...report.qaFindings,
      ...report.securityFindings,
      ...report.workflowFindings
    ]);

    const fullReport = renderMarkdownReport(report);
    const summary = renderMarkdownSummary(report);

    assert.match(fullReport, /\*\*Test signal evidence\*\*/);
    assert.match(fullReport, /\| Confidence \| 84% \(high confidence\) \|/);
    assert.match(fullReport, /Changed files:\n- `src\/referral\/rewardRules\.ts`\n- `src\/referral\/rewardService\.ts`/);
    assert.match(fullReport, /Expected test signals:\n- `src\/referral\/\*\.test\.ts`\n- `src\/referral\/\*\.spec\.ts`\n- `tests\/referral\/\*`/);
    assert.match(
      fullReport,
      /Detected related tests:\n- tests\/referral\/rewardRules\.test\.ts \(strong\)\n- tests\/outputContract\.test\.ts \(medium\)/
    );
    assert.match(fullReport, /Related test changes were detected; review whether they cover the changed behavior\./);
    assert.match(fullReport, /Heuristic coverage signals:\n- regression\n- output contract/);
    assert.match(fullReport, /Coverage signals still needing review:\n- negative path/);
    assert.doesNotMatch(fullReport, /coverage is guaranteed|coverage confirmed/i);
    assert.match(summary, /## QA Test Signal Evidence/);
    assert.match(summary, /Source change without related test signal: Related test changes were detected; review whether they cover the changed behavior\./);
    assert.match(
      summary,
      /Review test coverage for `src\/referral\/\*`; related test changes detected: tests\/referral\/rewardRules\.test\.ts, tests\/outputContract\.test\.ts\. Suggested coverage: happy path, duplicate\/abuse prevention, limit\/quota boundary\./
    );
    assert.doesNotMatch(fullReport, /overclaiming coverage failure/i);
    assert.doesNotMatch(summary, /overclaiming coverage failure/i);
  });

  it("renders suggested review only when domain suggestions exist", () => {
    const report = makeReport();
    report.suggestedReview = ["api: success response", "api: bad request"];

    const fullReport = renderMarkdownReport(report);
    const withoutSuggestions = renderMarkdownReport({ ...makeReport(), suggestedReview: [] });

    assert.match(fullReport, /Suggested review:\n\n- api: success response\n- api: bad request/);
    assert.doesNotMatch(withoutSuggestions, /Suggested review:/);
  });

  it("renders grouped QA evidence in full Markdown reports", () => {
    const report = makeReport();
    report.qaFindings = [
      {
        ...report.qaFindings[0],
        title: "Source change without related test signal",
        affectedFiles: ["src/cli/work/renderAgent.ts", "src/cli/work/taskFileRecommendations.ts"],
        suggestedTests: ["Review CLI work coverage."],
        testSignalEvidence: {
          changedFiles: ["src/cli/work/renderAgent.ts", "src/cli/work/taskFileRecommendations.ts"],
          expectedTestSignals: ["src/cli/work/*.test.ts", "tests/work/*"],
          detectedTestChanges: ["tests/cli/work.test.ts", "tests/cli/workOutputContract.test.ts"],
          detectedRelatedTests: [
            { path: "tests/cli/work.test.ts", score: "medium" },
            { path: "tests/cli/workOutputContract.test.ts", score: "weak" }
          ],
          detectedCoverageSignals: ["regression", "output_contract"],
          unconfirmedCoverageSignals: ["boundary"],
          suggestedCoverage: ["output contract", "regression", "edge cases"],
          evidenceGroups: [
            {
              name: "src/cli/work/*",
              changedFiles: ["src/cli/work/renderAgent.ts", "src/cli/work/taskFileRecommendations.ts"],
              detectedTests: ["tests/cli/work.test.ts", "tests/cli/workOutputContract.test.ts"],
              detectedCoverageSignals: ["regression", "output_contract"],
              suggestedReview: ["output contract", "regression", "edge cases"]
            }
          ],
          reason: "Related test changes were detected; review whether they cover the changed behavior."
        }
      }
    ];

    const fullReport = renderMarkdownReport(report);

    assert.match(fullReport, /QA Evidence Group: src\/cli\/work\/\*/);
    assert.match(fullReport, /Changed files:\n- renderAgent\.ts\n- taskFileRecommendations\.ts/);
    assert.match(fullReport, /Detected tests:\n- work\.test\.ts\n- workOutputContract\.test\.ts/);
    assert.match(fullReport, /Detected coverage signals:\n- regression\n- output contract/);
    assert.match(fullReport, /Suggested review:\n- output contract\n- regression\n- edge cases/);
    assert.doesNotMatch(fullReport, /Expected test signals:\n- `src\/cli\/work\/\*\.test\.ts`/);
  });

  it("renders multiple grouped QA evidence blocks including fallback groups and keeps summary compact", () => {
    const report = makeReportWithGroupedQaEvidence([
      {
        name: "src/api/orders/*",
        changedFiles: ["src/api/orders/route.ts"],
        detectedTests: ["tests/ordersCoverage.test.ts"],
        detectedCoverageSignals: ["happy_path", "validation"],
        suggestedReview: ["api: success response", "api: bad request", "suggested review"]
      },
      {
        name: "server*",
        changedFiles: ["server.ts"],
        detectedTests: [],
        detectedCoverageSignals: [],
        suggestedReview: []
      }
    ]);
    const fullReport = renderMarkdownReport(report);
    const summary = renderMarkdownSummary(report);

    assert.match(fullReport, /QA Evidence Group: src\/api\/orders\/\*/);
    assert.match(fullReport, /Changed files:\n- route\.ts/);
    assert.match(fullReport, /Detected tests:\n- ordersCoverage\.test\.ts/);
    assert.match(fullReport, /Detected coverage signals:\n- happy path\n- validation/);
    assert.match(fullReport, /Suggested review:\n- api: success response\n- api: bad request\n- suggested review/);
    assert.match(fullReport, /QA Evidence Group: server\*/);
    assert.match(fullReport, /QA Evidence Group: server\*[\s\S]*Detected tests:\nNone\./);
    assert.doesNotMatch(sectionFor(fullReport, "QA Evidence Group: server*"), /Suggested review:/);
    assert.doesNotMatch(summary, /QA Evidence Group:/);
    assert.doesNotMatch(summary, /Suggested review:/);
  });

  it("keeps JSON report QA evidence fields stable", () => {
    const report = makeReportWithQaEvidence();
    const parsed = JSON.parse(renderReport(report, "json")) as GuardianReport;
    const evidence = parsed.qaFindings[0]?.testSignalEvidence;

    assert.deepEqual(evidence?.detectedTestChanges, [
      "tests/referral/rewardRules.test.ts",
      "tests/outputContract.test.ts",
      "tests/referral/auditTrail.test.ts"
    ]);
    assert.deepEqual(evidence?.detectedRelatedTests, [
      { path: "tests/referral/rewardRules.test.ts", score: "strong" },
      { path: "tests/outputContract.test.ts", score: "medium" },
      { path: "tests/referral/auditTrail.test.ts", score: "weak" }
    ]);
    assert.deepEqual(evidence?.detectedCoverageSignals, ["regression", "output_contract"]);
    assert.deepEqual(evidence?.unconfirmedCoverageSignals, ["negative_path"]);
    assert.equal(parsed.qaFindings[0]?.confidence, 84);
  });

  it("keeps JSON output contract for domain suggestions and grouped QA evidence", () => {
    const report = makeReportWithGroupedQaEvidence([
      {
        name: "src/cli/work/*",
        changedFiles: ["src/cli/work/renderAgent.ts", "src/cli/work/taskFileRecommendations.ts"],
        detectedTests: ["tests/cli/work.test.ts"],
        detectedCoverageSignals: ["regression"],
        suggestedReview: ["output contract", "regression"]
      }
    ]);
    report.suggestedReview = ["cli: valid command", "cli: output contract"];

    const parsed = JSON.parse(renderReport(report, "json")) as GuardianReport;

    assert.deepEqual(parsed.suggestedReview, ["cli: valid command", "cli: output contract"]);
    assert.deepEqual(parsed.qaFindings[0].testSignalEvidence?.evidenceGroups, [
      {
        name: "src/cli/work/*",
        changedFiles: ["src/cli/work/renderAgent.ts", "src/cli/work/taskFileRecommendations.ts"],
        detectedTests: ["tests/cli/work.test.ts"],
        detectedCoverageSignals: ["regression"],
        suggestedReview: ["output contract", "regression"]
      }
    ]);
  });

  it("keeps report output compact while showing scored QA evidence", () => {
    const report = makeReportWithQaEvidence();
    const fullReport = renderMarkdownReport(report);
    const summary = renderMarkdownSummary(report);

    assert.equal(countOccurrences(fullReport, "**Test signal evidence**"), 1);
    assert.equal(countOccurrences(fullReport, "Heuristic coverage signals:"), 1);
    assert.match(fullReport, /Detected related tests:\n- tests\/referral\/rewardRules\.test\.ts \(strong\)\n- tests\/outputContract\.test\.ts \(medium\)\n- tests\/referral\/auditTrail\.test\.ts \(weak\)/);
    assert.doesNotMatch(summary, /Heuristic coverage signals:|Coverage signals still needing review:/);
    assert.ok(summary.split("\n").length < fullReport.split("\n").length);
  });

  it("does not return old negative-coverage overclaiming wording when related tests exist", () => {
    const report = makeReportWithQaEvidence({
      title: "Auth/security-sensitive files changed; negative-path coverage not confirmed",
      description: "Auth/security-sensitive files changed. Related tests were detected, but negative-path coverage was not confirmed."
    });
    const combined = [renderMarkdownReport(report), renderMarkdownSummary(report), renderReport(report, "json")].join("\n");

    assertNoOldNegativeCoverageWording(combined);
    assert.match(combined, /Related tests were detected, but negative-path coverage was not confirmed/);
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
        expected: "Merge requires review because 1 review-required code/test/security finding(s) need attention before merge."
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

    assert.match(renderMarkdownSummary(report), /Merge requires review because 1 review-required code\/test\/security finding\(s\) need attention before merge\./);
  });

  it("adds missing config onboarding guidance to Markdown reports", () => {
    const report = {
      ...makeReport(),
      warnings: ['guardian.config.json was not found; using default config for project "demo".']
    };

    assert.match(renderMarkdownReport(report), new RegExp(escapeRegExp(missingConfigOnboardingNote)));
    assert.match(renderMarkdownSummary(report), new RegExp(escapeRegExp(missingConfigOnboardingNote)));
  });

  it("adds missing Project Brain onboarding guidance to Markdown reports", () => {
    const report = {
      ...makeReport(),
      warnings: ["Project Brain context was not found; continuing without repository-specific context."]
    };

    assert.match(renderMarkdownReport(report), new RegExp(escapeRegExp(missingProjectBrainOnboardingNote)));
    assert.match(renderMarkdownSummary(report), new RegExp(escapeRegExp(missingProjectBrainOnboardingNote)));
  });

  it("renders each onboarding guidance item only once per Markdown report", () => {
    const report = {
      ...makeReport(),
      warnings: [
        'guardian.config.json was not found; using default config for project "demo".',
        "guardian.config.json was not found; using safe defaults.",
        "Project Brain context was not found; continuing without repository-specific context.",
        "Project Brain context was not found; continuing without repository-specific context.",
        "Default base ref origin/main could not be used; using main."
      ]
    };

    const fullReport = renderMarkdownReport(report);
    const summary = renderMarkdownSummary(report);
    const configNote = 'guardian.config.json was not found; using default config for project "AI Restaurants".';
    const rawProjectBrainNote = "Project Brain context was not found; continuing without repository-specific context.";

    assert.equal(countOccurrences(fullReport, missingConfigOnboardingNote), 1);
    assert.equal(countOccurrences(fullReport, missingProjectBrainOnboardingNote), 1);
    assert.equal(countOccurrences(fullReport, configNote), 1);
    assert.equal(countOccurrences(fullReport, rawProjectBrainNote), 0);
    assert.equal(countOccurrences(fullReport, "Default base ref origin/main could not be used; using main."), 1);

    assert.equal(countOccurrences(summary, missingConfigOnboardingNote), 1);
    assert.equal(countOccurrences(summary, missingProjectBrainOnboardingNote), 1);
    assert.equal(countOccurrences(summary, configNote), 1);
    assert.equal(countOccurrences(summary, rawProjectBrainNote), 0);
    assert.equal(countOccurrences(summary, "Default base ref origin/main could not be used; using main."), 1);
  });

  it("keeps summary notes readable while deduplicating Project Brain and config warnings", () => {
    const report = {
      ...makeReport(),
      projectName: "guardian-risk-fixture",
      warnings: [
        "Project Brain context was not found; continuing without repository-specific context.",
        'guardian.config.json was not found; using default config for project "guardian-risk-fixture".',
        "Default base ref origin/main could not be used; using main.",
        "Local working tree changes were included in changed-file detection."
      ]
    };
    const summary = renderMarkdownSummary(report);

    assert.match(
      summary,
      /## Notes\n\n- Run with `--full-report` for changed files, detailed findings, accepted findings, and suggested tests\.\n- Tip: Run `npx ai-project-guardian init` to generate config, Project Brain templates, and GitHub Actions workflow\.\n- Project Brain context was not found\. Add `\.project-brain\/` repository-specific context to improve report quality\.\n- guardian\.config\.json was not found; using default config for project "guardian-risk-fixture"\.\n- Default base ref origin\/main could not be used; using main\.\n- Local working tree changes were included in changed-file detection\./
    );
  });

  it("deduplicates Project Brain notes in the full Markdown report", () => {
    const report = {
      ...makeReport(),
      warnings: [
        "Project Brain context was not found; continuing without repository-specific context.",
        "Project Brain context was not found; continuing without repository-specific context."
      ]
    };
    const fullReport = renderMarkdownReport(report);

    assert.equal(countOccurrences(fullReport, missingProjectBrainOnboardingNote), 1);
    assert.equal(countOccurrences(fullReport, "Project Brain context was not found; continuing without repository-specific context."), 0);
  });

  it("keeps onboarding guidance out of PR comments, JSON reports, and SARIF reports", () => {
    const report = {
      ...makeReport(),
      warnings: [
        'guardian.config.json was not found; using default config for project "demo".',
        "Project Brain context was not found; continuing without repository-specific context."
      ]
    };

    assert.doesNotMatch(renderPrComment(report), new RegExp(escapeRegExp(missingConfigOnboardingNote)));
    assert.doesNotMatch(renderPrComment(report), new RegExp(escapeRegExp(missingProjectBrainOnboardingNote)));
    assert.doesNotMatch(renderReport(report, "json"), new RegExp(escapeRegExp(missingConfigOnboardingNote)));
    assert.doesNotMatch(renderReport(report, "json"), new RegExp(escapeRegExp(missingProjectBrainOnboardingNote)));
    assert.doesNotMatch(renderReport(report, "sarif"), new RegExp(escapeRegExp(missingConfigOnboardingNote)));
    assert.doesNotMatch(renderReport(report, "sarif"), new RegExp(escapeRegExp(missingProjectBrainOnboardingNote)));
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
        title: "Route or API changed without clear API/integration test signal",
        description: "A route, controller, handler, or API file appears to have changed without a clear API or integration test signal.",
        riskLevel: "high",
        confidence: 84,
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
        confidence: 61,
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

function makeReportWithQaEvidence(overrides: Partial<GuardianReport["qaFindings"][number]> = {}): GuardianReport {
  const report = makeReport();

  report.qaFindings = [
    {
      ...report.qaFindings[0],
      title: "Source change without related test signal",
      affectedFiles: ["src/referral/rewardService.ts", "src/referral/rewardRules.ts"],
      suggestedTests: ["Review related referral test coverage."],
      confidence: 84,
      testSignalEvidence: {
        changedFiles: ["src/referral/rewardRules.ts", "src/referral/rewardService.ts"],
        expectedTestSignals: ["src/referral/*.test.ts", "src/referral/*.spec.ts", "tests/referral/*"],
        detectedTestChanges: [
          "tests/referral/rewardRules.test.ts",
          "tests/outputContract.test.ts",
          "tests/referral/auditTrail.test.ts"
        ],
        detectedRelatedTests: [
          { path: "tests/referral/rewardRules.test.ts", score: "strong" },
          { path: "tests/outputContract.test.ts", score: "medium" },
          { path: "tests/referral/auditTrail.test.ts", score: "weak" }
        ],
        detectedCoverageSignals: ["regression", "output_contract"],
        unconfirmedCoverageSignals: ["negative_path"],
        suggestedCoverage: ["happy path", "duplicate/abuse prevention", "limit/quota boundary"],
        reason: "Related test changes were detected; review whether they cover the changed behavior."
      },
      ...overrides
    }
  ];
  report.actionableGuidance = buildActionableGuidance([
    ...report.releaseFindings,
    ...report.qaFindings,
    ...report.securityFindings,
    ...report.workflowFindings
  ]);

  return report;
}

function makeReportWithGroupedQaEvidence(
  evidenceGroups: NonNullable<NonNullable<GuardianReport["qaFindings"][number]["testSignalEvidence"]>["evidenceGroups"]>
): GuardianReport {
  const report = makeReport();

  report.qaFindings = [
    {
      ...report.qaFindings[0],
      title: "Source change without related test signal",
      affectedFiles: evidenceGroups.flatMap((group) => group.changedFiles),
      suggestedTests: ["Review grouped QA evidence."],
      confidence: 84,
      testSignalEvidence: {
        changedFiles: evidenceGroups.flatMap((group) => group.changedFiles),
        expectedTestSignals: ["src/**/*.test.ts", "tests/**/*"],
        detectedTestChanges: evidenceGroups.flatMap((group) => group.detectedTests),
        detectedRelatedTests: evidenceGroups.flatMap((group) => group.detectedTests.map((path) => ({ path, score: "medium" as const }))),
        detectedCoverageSignals: ["regression", "output_contract"],
        unconfirmedCoverageSignals: ["negative_path"],
        suggestedCoverage: ["output contract", "regression", "edge cases"],
        evidenceGroups,
        reason: "Related test changes were detected; review whether they cover the changed behavior."
      }
    }
  ];
  report.actionableGuidance = buildActionableGuidance([
    ...report.releaseFindings,
    ...report.qaFindings,
    ...report.securityFindings,
    ...report.workflowFindings
  ]);

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

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function sectionFor(value: string, heading: string): string {
  const start = value.indexOf(heading);

  if (start === -1) {
    return "";
  }

  const next = value.indexOf("\n\nQA Evidence Group:", start + heading.length);
  return next === -1 ? value.slice(start) : value.slice(start, next);
}

function assertNoOldNegativeCoverageWording(value: string): void {
  for (const phrase of [
    ["without negative", "test coverage"],
    ["missing negative", "test coverage"],
    ["missing negative", "coverage"],
    ["no negative", "test coverage"]
  ]) {
    assert.doesNotMatch(value, new RegExp(phrase.join(" "), "i"));
  }
}
