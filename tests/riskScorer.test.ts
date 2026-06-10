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
  it("keeps documentation-only changes in the 0-10 range", () => {
    const result = scoreRisk({
      changedFiles: Array.from({ length: 5 }, (_, index) =>
        changedFile({
          path: `docs/page-${index}.md`,
          category: "documentation",
          riskLevel: "info"
        })
      ),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 8);
    assert.equal(result.overallRisk, "info");
  });

  it("keeps config-only changes in the 10-25 range", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "tsconfig.json",
          category: "config",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 19);
    assert.equal(result.overallRisk, "info");
  });

  it("keeps workflow-only changes in the 25-50 range", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: ".github/workflows/ci.yml",
          category: "ci",
          riskLevel: "medium"
        })
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-github-actions-changed", riskLevel: "high" })],
      securityFindings: []
    });

    assert.equal(result.score, 44);
    assert.equal(result.overallRisk, "medium");
  });

  it("keeps workflow plus deploy config changes in the 50-70 range", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: ".github/workflows/deploy.yml",
          category: "ci",
          riskLevel: "high"
        }),
        changedFile({
          path: ".env.production.example",
          category: "config",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [
        releaseFinding({ id: "release-github-actions-changed", riskLevel: "high" }),
        releaseFinding({ id: "release-env-config-changed", riskLevel: "medium" })
      ],
      securityFindings: []
    });

    assert.equal(result.score, 69);
    assert.equal(result.overallRisk, "high");
  });

  it("keeps migration changes in the 60-80 range when DB tests are not missing", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/db/migrations/001_create_users.sql",
          category: "migration",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-migration-changed", riskLevel: "high" })],
      securityFindings: []
    });

    assert.equal(result.score, 75);
    assert.equal(result.overallRisk, "high");
  });

  it("keeps auth changes in the 70-90 range when negative tests are not missing", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/auth/session.ts",
          category: "security",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 77);
    assert.equal(result.overallRisk, "high");
  });

  it("keeps security findings in the 80-100 range", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/api/reservations.ts",
          category: "source",
          riskLevel: "medium"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding({ riskLevel: "high" })]
    });

    assert.equal(result.score, 89);
    assert.equal(result.overallRisk, "critical");
  });

  it("prevents documentation changes from inflating non-documentation risk", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: ".github/workflows/ci.yml",
          category: "ci",
          riskLevel: "medium"
        }),
        ...Array.from({ length: 20 }, (_, index) =>
          changedFile({
            path: `docs/page-${index}.md`,
            category: "documentation",
            riskLevel: "info"
          })
        )
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-github-actions-changed", riskLevel: "high" })],
      securityFindings: []
    });

    assert.equal(result.score, 44);
    assert.equal(result.overallRisk, "medium");
  });

  it("marks migration plus missing DB test coverage as critical", () => {
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

    assert.equal(result.score, 91);
    assert.equal(result.overallRisk, "critical");
  });

  it("marks auth plus missing negative test coverage as critical", () => {
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

    assert.equal(result.score, 91);
    assert.equal(result.overallRisk, "critical");
  });

  it("marks payment plus missing integration test coverage as critical", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/payments/checkout.ts",
          category: "source",
          riskLevel: "medium"
        })
      ],
      qaFindings: [
        qaFinding({
          id: "qa-api-without-integration-test",
          riskLevel: "high",
          affectedFiles: ["src/payments/checkout.ts"]
        })
      ],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(result.score, 91);
    assert.equal(result.overallRisk, "critical");
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
