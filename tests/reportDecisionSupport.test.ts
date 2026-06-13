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

  it("classifies QA, security, workflow, external, and correlated findings as blocking findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown(),
      qaFindings: [qaFinding("medium")],
      releaseFindings: [releaseFinding("critical")],
      securityFindings: [securityFinding("high")],
      workflowFindings: [workflowFinding("medium")],
      externalFindings: [externalFinding("low")],
      correlatedFindings: [correlatedFinding("critical")]
    });

    assert.equal(decisionSupport.blockingFindingsCount, 5);
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

  it("requires review for lower-severity blocking findings", () => {
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

    assert.equal(decisionSupport.blockingFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "review_required");
    assert.match(decisionSupport.riskReason, /1 blocking finding\(s\) require review/);
  });

  it("blocks when the auth/security critical floor applies", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      scoreBreakdown: scoreBreakdown({
        criticalFloorApplied: {
          applied: true,
          floor: 91,
          reason: "Auth or security changed without negative test coverage"
        }
      }),
      qaFindings: [qaFinding("high")],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.mergeRecommendation, "blocked");
    assert.equal(decisionSupport.riskReason, "Auth/security changed without negative test coverage.");
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

function securityFinding(riskLevel: RiskLevel): SecurityFinding {
  return {
    id: "security-finding",
    area: "security",
    title: "Security finding",
    description: "Security finding.",
    riskLevel,
    filePath: "src/example.ts"
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

function correlatedFinding(riskLevel: RiskLevel): CorrelatedFinding {
  return {
    id: "correlated-finding",
    title: "Correlated finding",
    riskLevel,
    sources: ["guardian", "semgrep"],
    findingIds: ["security-finding", "external-finding"],
    confidence: "multi-tool"
  };
}
