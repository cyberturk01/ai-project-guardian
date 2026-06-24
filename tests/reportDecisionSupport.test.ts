import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReportDecisionSupport } from "../src/core/reportDecisionSupport.js";
import type {
  CorrelatedFinding,
  ExternalFinding,
  QaFinding,
  ReleaseFinding,
  RiskLevel,
  ScoreBreakdown,
  SecurityFinding,
  WorkflowFinding
} from "../src/core/types.js";

describe("buildReportDecisionSupport", () => {
  it("classifies release findings as checklist findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [releaseFinding("high"), releaseFinding("medium")],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.checklistFindingsCount, 2);
    assert.equal(decisionSupport.mergeRecommendation, "safe_after_checklist");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.releaseChecklistRisk, "high");
    assert.equal(decisionSupport.riskReason, "Only release checklist items remain.");
  });

  it("classifies blocking QA, high security, workflow, and high correlations as blocking findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [authQaFinding({ confidence: 84 })],
      releaseFindings: [releaseFinding("critical")],
      securityFindings: [securityFinding("high")],
      workflowFindings: [workflowFinding("medium")],
      externalFindings: [externalFinding("low")],
      correlatedFindings: [correlatedFinding("critical")]
    });

    assert.equal(decisionSupport.blockingFindingsCount, 4);
    assert.equal(decisionSupport.checklistFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.codeRisk, "critical");
    assert.equal(decisionSupport.releaseChecklistRisk, "critical");
    assert.equal(decisionSupport.riskReason, "Security findings require review.");
  });

  it("recommends safe when there are no active findings and the score risk is low or medium", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "medium",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.checklistFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "safe");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.releaseChecklistRisk, "info");
    assert.equal(decisionSupport.riskReason, "No blocking findings remain.");
  });

  it("requires review for review-only QA findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "medium",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [qaFinding("medium")],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.equal(decisionSupport.riskReason, "1 QA finding(s) need review, but are not blocking.");
  });

  it("requires review for workflow-only findings instead of blocking automatically", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "low",
      scoreBreakdown: scoreBreakdown({ selectedBand: "workflow" }),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [workflowFinding("high")],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.equal(decisionSupport.codeRisk, "high");
    assert.match(decisionSupport.riskReason, /1 blocking finding\(s\) require review/);
  });

  it("does not block merge for low or medium heuristic security findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "medium",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding("low"), securityFinding("medium")],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "safe");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.riskReason, "No blocking findings remain.");
  });

  it("does not block merge for security findings explicitly marked non-blocking", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "medium",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding("high", { blocking: false, fixture_like: true })],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "safe");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.riskReason, "No blocking findings remain.");
  });

  it("does not double-count single-tool correlations as blocking findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding("high")],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: [correlatedFinding("high", "single-tool")]
    });

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.codeRisk, "high");
    assert.equal(decisionSupport.riskReason, "Security findings require review.");
  });

  it("counts multi-tool correlations as blocking findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: [correlatedFinding("high", "multi-tool")]
    });

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.codeRisk, "high");
    assert.equal(decisionSupport.riskReason, "Security findings require review.");
  });

  it("blocks when the auth/security critical floor applies", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown({
        criticalFloorApplied: {
          applied: true,
          floor: 91,
          reason: "Auth/security-sensitive change with no related test signal"
        }
      }),
      qaFindings: [authQaFinding({ confidence: 84 })],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(
      decisionSupport.riskReason,
      "Auth/security-sensitive files changed with no related test signal; negative-path coverage was not confirmed."
    );
  });

  it("does not block when the auth/security critical floor has only review-only QA evidence", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown({
        selectedBand: "auth",
        criticalFloorApplied: {
          applied: true,
          floor: 91,
          reason: "Auth/security-sensitive change with no related test signal"
        }
      }),
      qaFindings: [authQaFinding({ confidence: 44 })],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.equal(decisionSupport.codeRisk, "medium");
    assert.equal(decisionSupport.riskReason, "1 QA finding(s) need review, but are not blocking.");
  });

  it("requires review instead of blocking when auth related tests exist but adequacy is unconfirmed", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown({ selectedBand: "auth" }),
      qaFindings: [authQaFinding({ confidence: 84, relatedScore: "strong" })],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.equal(decisionSupport.codeRisk, "medium");
    assert.equal(decisionSupport.riskReason, "1 QA finding(s) need review, but are not blocking.");
  });

  it("does not block when related weak test evidence leaves adequacy unconfirmed", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown({ selectedBand: "auth" }),
      qaFindings: [authQaFinding({ confidence: 64, relatedScore: "weak" })],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.equal(decisionSupport.riskReason, "1 QA finding(s) need review, but are not blocking.");
  });

  it("keeps covered auth/security changes elevated after blocking findings clear", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "medium",
      scoreBreakdown: scoreBreakdown({ selectedBand: "auth" }),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "safe");
    assert.equal(decisionSupport.codeRisk, "medium");
    assert.equal(decisionSupport.riskReason, "No blocking findings remain.");
  });

  it("keeps actual security findings blocking even when the score band is calibrated", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown({ selectedBand: "auth" }),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding("high")],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.codeRisk, "high");
    assert.equal(decisionSupport.riskReason, "Security findings require review.");
  });

  it("blocks on high external scanner findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      scoreBreakdown: scoreBreakdown({ selectedBand: "security" }),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [externalFinding("high")],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.codeRisk, "high");
    assert.equal(decisionSupport.riskReason, "Security findings require review.");
  });
});

function scoreBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    selectedBand: "source",
    bandBase: 32,
    bandMax: 60,
    bandFactor: 2,
    weightedSignal: 0,
    changedFileScore: 0,
    qaFindingScore: 0,
    releaseFindingScore: 0,
    securityFindingScore: 0,
    workflowFindingScore: 0,
    externalFindingScore: 0,
    correlatedFindingScore: 0,
    criticalFloorApplied: { applied: false },
    ...overrides
  };
}

function qaFinding(riskLevel: RiskLevel): QaFinding {
  return {
    id: "qa-finding",
    area: "qa",
    title: "QA finding",
    description: "QA finding.",
    riskLevel,
    affectedFiles: ["src/example.ts"],
    suggestedTests: ["Add coverage."]
  };
}

function authQaFinding(options: { confidence: number; relatedScore?: "strong" | "medium" | "weak" }): QaFinding {
  const detectedRelatedTests =
    options.relatedScore === undefined
      ? []
      : [{ path: "tests/auth/session.test.ts", score: options.relatedScore }];

  return {
    ...qaFinding("high"),
    id: "qa-auth-security-without-negative-test",
    title: "Auth/security-sensitive files changed; negative-path coverage not confirmed",
    description:
      detectedRelatedTests.length === 0
        ? "Auth/security-sensitive files changed. No related test signal was detected, so negative-path coverage could not be confirmed."
        : "Auth/security-sensitive files changed. Related tests were detected, but negative-path coverage was not confirmed.",
    confidence: options.confidence,
    testSignalEvidence: {
      changedFiles: ["src/auth/session.ts"],
      expectedTestSignals: ["tests/auth/session.unauthorized.test.ts"],
      detectedTestChanges: detectedRelatedTests.map((test) => test.path),
      detectedRelatedTests,
      detectedCoverageSignals: detectedRelatedTests.length === 0 ? [] : ["authorization"],
      unconfirmedCoverageSignals: ["negative_path"],
      suggestedCoverage: ["negative unauthorized path"],
      reason:
        detectedRelatedTests.length === 0
          ? "No related test change detected."
          : "Related test changes were detected; review whether they cover the changed behavior."
    }
  };
}

function releaseFinding(riskLevel: RiskLevel): ReleaseFinding {
  return {
    id: "release-finding",
    area: "release",
    title: "Release finding",
    description: "Release finding.",
    riskLevel,
    affectedFiles: ["package.json"],
    whyItMatters: "Release readiness can change.",
    requiredBeforeDeploy: ["Review release checklist."]
  };
}

function securityFinding(riskLevel: RiskLevel, overrides: Partial<SecurityFinding> = {}): SecurityFinding {
  return {
    id: "security-finding",
    area: "security",
    title: "Security finding",
    description: "Security finding.",
    riskLevel,
    filePath: "src/example.ts",
    ...overrides
  };
}

function workflowFinding(riskLevel: RiskLevel): WorkflowFinding {
  return {
    id: "workflow-finding",
    area: "workflow",
    title: "Workflow finding",
    description: "Workflow finding.",
    riskLevel,
    missingCheck: "npm test",
    workflowFile: ".github/workflows/ci.yml"
  };
}

function externalFinding(riskLevel: RiskLevel): ExternalFinding {
  return {
    id: "external-finding",
    source: "semgrep",
    ruleId: "external.rule",
    title: "External finding",
    description: "External finding.",
    riskLevel,
    artifactPath: "semgrep.json"
  };
}

function correlatedFinding(riskLevel: RiskLevel, confidence: CorrelatedFinding["confidence"] = "multi-tool"): CorrelatedFinding {
  return {
    id: "correlated-finding",
    title: "Correlated finding",
    riskLevel,
    sources: ["guardian", "semgrep"],
    findingIds: ["security-finding", "external-finding"],
    confidence
  };
}
