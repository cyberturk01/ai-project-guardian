import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildActionableGuidance, buildRequiredDeployActions } from "../src/core/actionableGuidance.js";
import type { GuardianFinding, QaFinding, ReleaseFinding, RiskLevel, SecurityFinding, WorkflowFinding } from "../src/core/types.js";

describe("buildRequiredDeployActions", () => {
  it("uses release requiredBeforeDeploy items", () => {
    assert.deepEqual(buildRequiredDeployActions([releaseFinding("Deploy review", "high", ["Validate workflow triggers"])]), [
      "Validate workflow triggers"
    ]);
  });

  it("deduplicates deploy actions by normalized text", () => {
    assert.deepEqual(
      buildRequiredDeployActions([
        releaseFinding("Deploy review", "high", ["Validate workflow triggers"]),
        releaseFinding("Deploy review copy", "medium", [" validate   workflow triggers "])
      ]),
      ["Validate workflow triggers"]
    );
  });
});

describe("buildActionableGuidance", () => {
  it("creates release guidance from requiredBeforeDeploy", () => {
    const guidance = buildActionableGuidance([releaseFinding("Deploy review", "high", ["Validate workflow triggers"])]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].area, "release");
    assert.equal(guidance[0].action, "Validate workflow triggers");
  });

  it("creates QA guidance from suggestedTests", () => {
    const guidance = buildActionableGuidance([qaFinding("Missing integration test", "high", ["Add integration coverage"])]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].area, "qa");
    assert.equal(guidance[0].action, "Add integration coverage");
  });

  it("creates security guidance from recommendation", () => {
    const guidance = buildActionableGuidance([securityFinding("Possible hardcoded secret", "high", "Rotate exposed secret")]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].area, "security");
    assert.equal(guidance[0].action, "Rotate exposed secret");
  });

  it("creates workflow guidance from recommendation", () => {
    const guidance = buildActionableGuidance([workflowFinding("Required workflow check is missing", "high", "Add npm test")]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].area, "workflow");
    assert.equal(guidance[0].action, "Add npm test");
  });

  it("deduplicates guidance by normalized action text", () => {
    const guidance = buildActionableGuidance([
      qaFinding("Missing integration test", "high", ["Add integration coverage"]),
      workflowFinding("Required workflow check is missing", "medium", " add   integration coverage ")
    ]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].action, "Add integration coverage");
  });

  it("groups repeated UI component/e2e guidance into one concise action", () => {
    const guidance = buildActionableGuidance([
      qaFinding("UI changed without component or e2e coverage", "medium", [
        "Add component tests for touched UI components, or Cypress/e2e coverage for page flows (examples: src/components/MenuCard.tsx, src/pages/CheckoutPage.tsx)."
      ], {
        id: "qa-ui-without-cypress-test",
        affectedFiles: ["src/components/MenuCard.tsx", "src/pages/CheckoutPage.tsx"]
      })
    ]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].action, "Add component tests for touched UI components, or Cypress/e2e coverage for page flows.");
  });

  it("groups repeated nearby unit guidance into one concise action", () => {
    const guidance = buildActionableGuidance([
      qaFinding("Source changed without nearby test coverage", "medium", [
        "Create or update nearby unit tests for touched source files (examples: src/services/menuService.ts, src/domain/pricing.ts)."
      ], {
        id: "qa-source-without-nearby-test",
        affectedFiles: ["src/services/menuService.ts", "src/domain/pricing.ts"]
      })
    ]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].action, "Create or update nearby unit tests for touched source files.");
  });

  it("keeps the highest-risk item when duplicate guidance exists", () => {
    const guidance = buildActionableGuidance([
      qaFinding("Missing integration test", "medium", ["Review shared behavior"]),
      securityFinding("Possible hardcoded secret", "critical", "review shared behavior")
    ]);

    assert.equal(guidance.length, 1);
    assert.equal(guidance[0].area, "security");
    assert.equal(guidance[0].riskLevel, "critical");
  });

  it("sorts by risk severity then area priority", () => {
    const guidance = buildActionableGuidance([
      qaFinding("Critical QA", "critical", ["Add critical regression coverage"]),
      releaseFinding("Critical release", "critical", ["Validate deploy readiness"]),
      workflowFinding("Critical workflow", "critical", "Restore required check"),
      securityFinding("Critical security", "critical", "Rotate leaked key")
    ]);

    assert.deepEqual(guidance.map((item) => item.area), ["release", "security", "workflow", "qa"]);
  });

  it("makes critical non-release reports actionable", () => {
    const findings: GuardianFinding[] = [
      securityFinding("Possible hardcoded secret", "critical", "Rotate exposed secret"),
      qaFinding("Missing negative test", "high", ["Add negative auth coverage"]),
      workflowFinding("Required workflow check is missing", "high", "Add npm test")
    ];

    assert.deepEqual(buildRequiredDeployActions([]), []);
    assert.ok(buildActionableGuidance(findings).length > 0);
  });
});

function qaFinding(
  title: string,
  riskLevel: RiskLevel,
  suggestedTests: string[],
  options: { id?: string; affectedFiles?: string[] } = {}
): QaFinding {
  return {
    id: options.id ?? title.toLowerCase().replaceAll(" ", "-"),
    area: "qa",
    title,
    description: `${title}.`,
    riskLevel,
    affectedFiles: options.affectedFiles ?? ["src/example.ts"],
    suggestedTests
  };
}

function releaseFinding(title: string, riskLevel: RiskLevel, requiredBeforeDeploy: string[]): ReleaseFinding {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "release",
    title,
    description: `${title}.`,
    riskLevel,
    affectedFiles: ["src/example.ts"],
    whyItMatters: `${title} affects release safety.`,
    requiredBeforeDeploy
  };
}

function securityFinding(title: string, riskLevel: RiskLevel, recommendation: string): SecurityFinding {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "security",
    title,
    description: `${title}.`,
    riskLevel,
    filePath: "src/example.ts",
    recommendation
  };
}

function workflowFinding(title: string, riskLevel: RiskLevel, recommendation: string): WorkflowFinding {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    area: "workflow",
    title,
    description: `${title}.`,
    riskLevel,
    missingCheck: "npm test",
    workflowFile: ".github/workflows/ci.yml",
    recommendation
  };
}
