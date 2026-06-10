import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { riskLevelForScore, scoreRisk } from "../src/analyzers/riskScorer.js";
import type { ChangedFile, QaFinding, ReleaseFinding, SecurityFinding } from "../src/core/types.js";

describe("riskLevelForScore", () => {
  it("maps scores to the configured risk scale", () => {
    assert.equal(riskLevelForScore(0), "info");
    assert.equal(riskLevelForScore(20), "info");
    assert.equal(riskLevelForScore(21), "low");
    assert.equal(riskLevelForScore(40), "low");
    assert.equal(riskLevelForScore(41), "medium");
    assert.equal(riskLevelForScore(60), "medium");
    assert.equal(riskLevelForScore(61), "high");
    assert.equal(riskLevelForScore(80), "high");
    assert.equal(riskLevelForScore(81), "critical");
    assert.equal(riskLevelForScore(100), "critical");
  });
});

describe("scoreRisk", () => {
  it("combines changed file, QA, release, and security risk into a numeric score", () => {
    const result = scoreRisk({
      changedFiles: [changedFile({ riskLevel: "medium" })],
      qaFindings: [qaFinding({ riskLevel: "medium" })],
      releaseFindings: [releaseFinding({ riskLevel: "low" })],
      securityFindings: [securityFinding({ riskLevel: "medium" })]
    });

    assert.equal(result.score, 42);
    assert.equal(result.overallRisk, "medium");
  });

  it("strongly increases score for a critical security finding", () => {
    const result = scoreRisk({
      changedFiles: [],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding({ riskLevel: "critical" })]
    });

    assert.equal(result.score, 81);
    assert.equal(result.overallRisk, "critical");
  });

  it("increases score when a migration is missing DB test coverage", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/db/migrations/001_create_users.sql",
          category: "migration",
          riskLevel: "high"
        })
      ],
      qaFindings: [
        qaFinding({
          id: "qa-migration-without-db-test",
          riskLevel: "high"
        })
      ],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 46);
    assert.equal(result.overallRisk, "medium");
  });

  it("increases score when an auth change is missing negative test coverage", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/auth/session.ts",
          category: "security",
          riskLevel: "high"
        })
      ],
      qaFindings: [
        qaFinding({
          id: "qa-auth-security-without-negative-test",
          riskLevel: "high"
        })
      ],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 46);
    assert.equal(result.overallRisk, "medium");
  });

  it("caps the score at 100", () => {
    const result = scoreRisk({
      changedFiles: Array.from({ length: 8 }, (_, index) =>
        changedFile({
          path: `src/security/file-${index}.ts`,
          category: "security",
          riskLevel: "critical"
        })
      ),
      qaFindings: [
        qaFinding({
          id: "qa-auth-security-without-negative-test",
          riskLevel: "high"
        })
      ],
      releaseFindings: [releaseFinding({ riskLevel: "critical" })],
      securityFindings: [securityFinding({ riskLevel: "critical" })]
    });

    assert.equal(result.score, 100);
    assert.equal(result.overallRisk, "critical");
  });
});

function changedFile(overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    path: "src/index.ts",
    status: "modified",
    category: "source",
    riskLevel: "low",
    ...overrides
  };
}

function qaFinding(overrides: Partial<QaFinding> = {}): QaFinding {
  return {
    id: "qa-source-without-nearby-test",
    area: "qa",
    title: "QA finding",
    description: "A QA finding.",
    riskLevel: "low",
    affectedFiles: ["src/index.ts"],
    suggestedTests: ["Add a test."],
    ...overrides
  };
}

function releaseFinding(overrides: Partial<ReleaseFinding> = {}): ReleaseFinding {
  return {
    id: "release-env-config-changed",
    area: "release",
    title: "Release finding",
    description: "A release finding.",
    riskLevel: "low",
    affectedFiles: [".env.example"],
    whyItMatters: "It can affect deployments.",
    requiredBeforeDeploy: ["Review config."],
    ...overrides
  };
}

function securityFinding(overrides: Partial<SecurityFinding> = {}): SecurityFinding {
  return {
    id: "security-hardcoded-secret",
    area: "security",
    title: "Security finding",
    description: "A security finding.",
    riskLevel: "low",
    filePath: "src/index.ts",
    recommendation: "Review the finding.",
    ...overrides
  };
}
