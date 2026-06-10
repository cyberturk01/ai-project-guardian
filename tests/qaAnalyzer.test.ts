import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeQa } from "../src/analyzers/qaAnalyzer.js";
import {
  coveredChangedFiles,
  coveredRepoFiles,
  guardianConfigFixture,
  projectBrainFixture,
  weakCoverageChangedFiles,
  weakCoverageRepoFiles
} from "./fixtures/qaAnalyzerFixtures.js";

describe("analyzeQa", () => {
  it("detects deterministic QA coverage gaps for changed files", () => {
    const findings = analyzeQa({
      changedFiles: weakCoverageChangedFiles,
      repoFiles: weakCoverageRepoFiles,
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      [
        "qa-source-without-nearby-test",
        "qa-api-without-integration-test",
        "qa-ui-without-cypress-test",
        "qa-migration-without-db-test",
        "qa-i18n-without-localization-test",
        "qa-auth-security-without-negative-test"
      ]
    );

    assert.deepEqual(findings[0].affectedFiles, ["src/services/menuService.ts"]);
    assert.equal(findings[1].riskLevel, "high");
    assert.deepEqual(findings[1].affectedFiles, ["src/routes/orderRoutes.ts"]);
    assert.match(findings[5].suggestedTests[0], /negative test/);
  });

  it("does not report findings when matching tests exist", () => {
    const findings = analyzeQa({
      changedFiles: coveredChangedFiles,
      repoFiles: coveredRepoFiles,
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("ignores deleted source files", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/services/legacyService.ts",
          status: "deleted",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: [],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("does not create QA findings for Project Brain documentation changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: ".project-brain/security-rules.md",
          status: "modified",
          category: "documentation",
          riskLevel: "info"
        }
      ],
      repoFiles: [".project-brain/security-rules.md"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("still reports missing negative tests for real auth and security code", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/session.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        }
      ],
      repoFiles: ["src/auth/session.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.ok(findings.some((finding) => finding.id === "qa-auth-security-without-negative-test"));
  });
});
