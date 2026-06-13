import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReportDecisionSupport } from "../src/core/reportDecisionSupport.js";
import type {
  CorrelatedFinding,
  ExternalFinding,
  QaFinding,
  ReleaseFinding,
  RiskLevel,
  SecurityFinding,
  WorkflowFinding
} from "../src/core/types.js";

describe("buildReportDecisionSupport", () => {
  it("classifies release findings as checklist findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "high",
      qaFindings: [],
      releaseFindings: [releaseFinding("high"), releaseFinding("medium")],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.checklistFindingsCount, 2);
    assert.equal(decisionSupport.mergeRecommendation, "review-checklist");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.releaseChecklistRisk, "high");
    assert.match(decisionSupport.riskReason, /2 release checklist finding\(s\)/);
  });

  it("classifies QA, security, workflow, external, and correlated findings as blocking findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "critical",
      qaFindings: [qaFinding("medium")],
      releaseFindings: [releaseFinding("critical")],
      securityFindings: [securityFinding("high")],
      workflowFindings: [workflowFinding("medium")],
      externalFindings: [externalFinding("low")],
      correlatedFindings: [correlatedFinding("critical")]
    });

    assert.equal(decisionSupport.blockingFindingsCount, 5);
    assert.equal(decisionSupport.checklistFindingsCount, 1);
    assert.equal(decisionSupport.mergeRecommendation, "block");
    assert.equal(decisionSupport.codeRisk, "critical");
    assert.equal(decisionSupport.releaseChecklistRisk, "critical");
    assert.match(decisionSupport.riskReason, /5 blocking finding\(s\)/);
  });

  it("recommends merge when there are no active findings", () => {
    const decisionSupport = buildReportDecisionSupport({
      overallRisk: "info",
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      workflowFindings: [],
      externalFindings: [],
      correlatedFindings: []
    });

    assert.equal(decisionSupport.blockingFindingsCount, 0);
    assert.equal(decisionSupport.checklistFindingsCount, 0);
    assert.equal(decisionSupport.mergeRecommendation, "merge");
    assert.equal(decisionSupport.codeRisk, "info");
    assert.equal(decisionSupport.releaseChecklistRisk, "info");
    assert.match(decisionSupport.riskReason, /No active blocking or release checklist findings/);
  });
});

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
