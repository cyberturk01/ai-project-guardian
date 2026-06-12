import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildActionableGuidance, buildRequiredDeployActions } from "../src/core/actionableGuidance.js";
import type { GuardianReport } from "../src/core/types.js";
import { renderReport } from "../src/renderers/renderReport.js";
import { renderSarifReport } from "../src/renderers/sarifReport.js";

type JsonSchema = {
  $ref?: string;
  type?: "object" | "array" | "string" | "number";
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  minItems?: number;
  minLength?: number;
  minimum?: number;
  $defs?: Record<string, JsonSchema>;
};

describe("renderSarifReport", () => {
  it("maps QA, security, and workflow findings to SARIF rules and results", () => {
    const sarif = renderSarifReport(makeReport());
    const run = sarif.runs[0];

    assert.equal(sarif.version, "2.1.0");
    assert.equal(sarif.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
    assert.deepEqual(
      run.tool.driver.rules.map((rule) => rule.id),
      [
        "qa-api-without-integration-test",
        "security-hardcoded-secret",
        "workflow-missing-required-check-npm-test"
      ]
    );
    assert.deepEqual(
      run.results.map((result) => result.ruleId),
      [
        "qa-api-without-integration-test",
        "security-hardcoded-secret",
        "workflow-missing-required-check-npm-test"
      ]
    );
    assert.deepEqual(
      run.results.map((result) => result.locations[0].physicalLocation.artifactLocation.uri),
      [
        "src/api/reservations.ts",
        "src/api/reservations.ts",
        ".github/workflows/ci.yml"
      ]
    );
    assert.equal(run.results[1].locations[0].physicalLocation.region?.startLine, 18);
  });

  it("does not include release findings in SARIF results", () => {
    const sarif = renderSarifReport(makeReport());

    assert.ok(!sarif.runs[0].results.some((result) => result.ruleId === "release-github-actions-changed"));
  });

  it("is used by the generic SARIF report renderer", () => {
    const report = makeReport();

    assert.deepEqual(JSON.parse(renderReport(report, "sarif")), renderSarifReport(report));
  });

  it("validates against the GitHub Code Scanning SARIF schema", () => {
    const schema = readSchema("github-code-scanning-sarif.schema.json");
    const sarif = renderSarifReport(makeReport());

    assert.deepEqual(validateSchema(schema, sarif), []);
    assertRuleReferencesExist(sarif);
  });
});

function makeReport(): GuardianReport {
  const report: GuardianReport = {
    projectName: "AI Restaurants",
    generatedAt: "2026-06-10T12:00:00.000Z",
    riskScore: 72,
    overallRisk: "high",
    scoreBreakdown: {
      selectedBand: "security",
      bandBase: 70,
      bandMax: 100,
      bandFactor: 2,
      weightedSignal: 44,
      changedFileScore: 0,
      qaFindingScore: 8,
      releaseFindingScore: 8,
      securityFindingScore: 18,
      workflowFindingScore: 10,
      externalFindingScore: 0,
      correlatedFindingScore: 0,
      criticalFloorApplied: { applied: false }
    },
    changedFiles: [],
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
        affectedFiles: [".github/workflows/ci.yml"],
        whyItMatters: "CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.",
        requiredBeforeDeploy: ["Review workflow triggers, permissions, environments, and secrets usage."]
      }
    ],
    securityFindings: [
      {
        id: "security-hardcoded-secret",
        area: "security",
        title: "Possible hardcoded secret",
        description: "Possible hardcoded secret detected in a changed file.",
        riskLevel: "high",
        filePath: "src/api/reservations.ts",
        lineNumber: 18,
        recommendation: "Move secrets to a managed secret store or environment variable."
      }
    ],
    workflowFindings: [
      {
        id: "workflow-missing-required-check-npm-test",
        area: "workflow",
        title: "Required workflow check is missing",
        description: "No GitHub Actions workflow command runs the required check: npm test.",
        riskLevel: "high",
        missingCheck: "npm test",
        workflowFile: ".github/workflows/ci.yml",
        recommendation: "Add the required check to a GitHub Actions workflow that runs before merge or release."
      }
    ],
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

function readSchema(fileName: string): JsonSchema {
  const compiledTestDir = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(compiledTestDir, "../../tests/schemas", fileName), "utf8")) as JsonSchema;
}

function validateSchema(schema: JsonSchema, value: unknown, path = "$", root = schema): string[] {
  const resolvedSchema = resolveRef(schema, root);
  const errors: string[] = [];

  if (resolvedSchema.const !== undefined && value !== resolvedSchema.const) {
    errors.push(`${path} must equal ${String(resolvedSchema.const)}`);
  }

  if (resolvedSchema.enum !== undefined && !resolvedSchema.enum.includes(value)) {
    errors.push(`${path} must be one of ${resolvedSchema.enum.map(String).join(", ")}`);
  }

  if (resolvedSchema.type !== undefined && !matchesType(value, resolvedSchema.type)) {
    errors.push(`${path} must be ${resolvedSchema.type}`);
    return errors;
  }

  if (typeof value === "string" && resolvedSchema.minLength !== undefined && value.length < resolvedSchema.minLength) {
    errors.push(`${path} must have length >= ${resolvedSchema.minLength}`);
  }

  if (typeof value === "number" && resolvedSchema.minimum !== undefined && value < resolvedSchema.minimum) {
    errors.push(`${path} must be >= ${resolvedSchema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (resolvedSchema.minItems !== undefined && value.length < resolvedSchema.minItems) {
      errors.push(`${path} must have at least ${resolvedSchema.minItems} item(s)`);
    }

    if (resolvedSchema.items !== undefined) {
      value.forEach((item, index) => errors.push(...validateSchema(resolvedSchema.items as JsonSchema, item, `${path}[${index}]`, root)));
    }
  }

  if (isRecord(value)) {
    for (const requiredProperty of resolvedSchema.required ?? []) {
      if (!(requiredProperty in value)) {
        errors.push(`${path}.${requiredProperty} is required`);
      }
    }

    for (const [propertyName, propertySchema] of Object.entries(resolvedSchema.properties ?? {})) {
      if (propertyName in value) {
        errors.push(...validateSchema(propertySchema, value[propertyName], `${path}.${propertyName}`, root));
      }
    }
  }

  return errors;
}

function resolveRef(schema: JsonSchema, root: JsonSchema): JsonSchema {
  if (schema.$ref === undefined) {
    return schema;
  }

  const refParts = schema.$ref.replace(/^#\//, "").split("/");
  let current: unknown = root;

  for (const part of refParts) {
    if (!isRecord(current)) {
      throw new Error(`Unsupported schema ref: ${schema.$ref}`);
    }

    current = current[part];
  }

  return current as JsonSchema;
}

function matchesType(value: unknown, type: JsonSchema["type"]): boolean {
  if (type === "array") {
    return Array.isArray(value);
  }

  if (type === "object") {
    return isRecord(value);
  }

  return typeof value === type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRuleReferencesExist(sarif: ReturnType<typeof renderSarifReport>): void {
  const run = sarif.runs[0];
  const ruleIds = new Set(run.tool.driver.rules.map((rule) => rule.id));

  for (const result of run.results) {
    assert.ok(ruleIds.has(result.ruleId), `SARIF result references missing rule ${result.ruleId}`);
  }
}
