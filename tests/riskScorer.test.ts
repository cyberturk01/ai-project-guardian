import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateRiskScore, riskLevelForScore, scoreRisk } from "../src/analyzers/riskScorer.js";
import type { ChangedFile, ExternalFinding, QaFinding, ReleaseFinding, SecurityFinding, WorkflowFinding } from "../src/core/types.js";

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

  it("keeps config-only changes in the 20-50 range", () => {
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

    assert.equal(result.score, 25);
    assert.equal(result.overallRisk, "low");
  });

  it("keeps workflow-only changes in the 20-40 range", () => {
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

    assert.equal(result.score, 29);
    assert.equal(result.overallRisk, "low");
  });

  it("keeps workflow plus deploy config changes in the workflow 20-40 range", () => {
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

    assert.equal(result.score, 31);
    assert.equal(result.overallRisk, "low");
  });

  it("keeps dependency-only changes as release checklist risk without forcing critical", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "package.json",
          category: "config",
          riskLevel: "high"
        }),
        changedFile({
          path: "package-lock.json",
          category: "config",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [
        releaseFinding({
          id: "release-package-dependency-changed",
          riskLevel: "medium",
          affectedFiles: ["package-lock.json", "package.json"]
        })
      ],
      securityFindings: []
    });

    assert.equal(result.scoreBreakdown.selectedBand, "config");
    assert.ok(result.score < 60);
    assert.notEqual(result.overallRisk, "critical");
  });

  it("keeps dependency-only changes below high without scanner findings", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({ path: "package.json", category: "config", riskLevel: "high" }),
        changedFile({ path: "package-lock.json", category: "config", riskLevel: "high" })
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-package-dependency-changed", riskLevel: "medium" })],
      securityFindings: []
    });

    assert.equal(result.scoreBreakdown.selectedBand, "config");
    assert.ok(result.score <= 60);
    assert.notEqual(result.overallRisk, "high");
    assert.notEqual(result.overallRisk, "critical");
  });

  it("keeps migration changes in the 50-80 range when DB tests are not missing", () => {
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

    assert.equal(result.score, 60);
    assert.equal(result.overallRisk, "medium");
  });

  it("caps auth changed-file-only risk below high when negative tests are not missing", () => {
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

    assert.ok(result.score <= 60);
    assert.equal(result.overallRisk, "medium");
  });

  it("keeps security findings in the 70-100 range", () => {
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

    assert.equal(result.score, 80);
    assert.equal(result.overallRisk, "high");
  });

  it("does not escalate one low heuristic security finding in a test file to security band critical risk", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "tests/auth/bypass.test.ts",
          category: "test",
          riskLevel: "low"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [
        securityFinding({
          id: "security-disabled-auth-check",
          riskLevel: "low",
          filePath: "tests/auth/bypass.test.ts"
        })
      ]
    });

    assert.notEqual(result.scoreBreakdown.selectedBand, "security");
    assert.ok(result.score < 70);
    assert.notEqual(result.overallRisk, "critical");
  });

  it("does not select the security band for medium heuristic security findings", () => {
    const result = scoreRisk({
      changedFiles: [changedFile({ path: "src/routes/publicRoutes.ts", category: "source", riskLevel: "medium" })],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [
        securityFinding({
          id: "security-cors-wildcard",
          riskLevel: "medium",
          filePath: "src/routes/publicRoutes.ts"
        })
      ]
    });

    assert.notEqual(result.scoreBreakdown.selectedBand, "security");
    assert.ok(result.score <= 60);
  });

  it("allows security findings to become critical when the score crosses the critical threshold", () => {
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
      securityFindings: [securityFinding({ riskLevel: "high" }), securityFinding({ id: "security-sql-string-interpolation", riskLevel: "medium" })]
    });

    assert.equal(result.score, 82);
    assert.equal(result.overallRisk, "critical");
  });

  it("increases risk when external scanners agree with Guardian findings", () => {
    const baseInput = {
      changedFiles: [
        changedFile({
          path: "src/api/reservations.ts",
          category: "source",
          riskLevel: "medium"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [securityFinding({ riskLevel: "high", filePath: "src/api/reservations.ts", lineNumber: 12 })],
      workflowFindings: []
    };
    const baseResult = scoreRisk(baseInput);
    const correlatedResult = scoreRisk({
      ...baseInput,
      externalFindings: [
        {
          id: "semgrep-hardcoded-secret",
          source: "semgrep",
          ruleId: "hardcoded-secret",
          title: "Security finding",
          description: "Security finding.",
          riskLevel: "high",
          filePath: "src/api/reservations.ts",
          lineNumber: 12,
          artifactPath: "reports/semgrep.json"
        }
      ],
      correlatedFindings: [
        {
          id: "correlated-hardcoded-secret",
          title: "Security finding",
          riskLevel: "high",
          filePath: "src/api/reservations.ts",
          lineNumber: 12,
          sources: ["guardian", "semgrep"],
          findingIds: ["security-hardcoded-secret", "semgrep-hardcoded-secret"],
          confidence: "multi-tool"
        }
      ]
    });

    assert.ok(correlatedResult.score > baseResult.score);
    assert.equal(correlatedResult.overallRisk, "critical");
  });

  it("treats high external scanner findings as high risk", () => {
    const result = scoreRisk({
      changedFiles: [changedFile({ path: "src/api/reservations.ts", category: "source", riskLevel: "medium" })],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      externalFindings: [externalFinding({ riskLevel: "high" })]
    });

    assert.equal(result.scoreBreakdown.selectedBand, "security");
    assert.equal(result.overallRisk, "high");
  });

  it("treats critical external scanner findings as critical risk", () => {
    const result = scoreRisk({
      changedFiles: [changedFile({ path: "src/api/reservations.ts", category: "source", riskLevel: "medium" })],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: [],
      externalFindings: [externalFinding({ riskLevel: "critical" })]
    });

    assert.equal(result.score, 87);
    assert.equal(result.overallRisk, "critical");
    assert.deepEqual(result.scoreBreakdown.criticalFloorApplied, {
      applied: false,
      floor: 81,
      reason: "Critical external scanner finding"
    });
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

    assert.equal(result.score, 29);
    assert.equal(result.overallRisk, "low");
  });

  it("never marks workflow-only changes as critical", () => {
    const result = scoreRisk({
      changedFiles: Array.from({ length: 20 }, (_, index) =>
        changedFile({
          path: `.github/workflows/workflow-${index}.yml`,
          category: "ci",
          riskLevel: "critical"
        })
      ),
      qaFindings: [],
      releaseFindings: Array.from({ length: 10 }, (_, index) =>
        releaseFinding({
          id: `release-github-actions-changed-${index}`,
          riskLevel: "critical",
          affectedFiles: [`.github/workflows/workflow-${index}.yml`]
        })
      ),
      securityFindings: [],
      workflowFindings: Array.from({ length: 10 }, (_, index) =>
        workflowFinding({
          id: `workflow-missing-required-check-${index}`,
          riskLevel: "critical"
        })
      )
    });

    assert.equal(result.score, 40);
    assert.notEqual(result.overallRisk, "critical");
  });

  it("keeps workflow changes in review territory without security signals", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: ".github/workflows/deploy.yml",
          category: "ci",
          riskLevel: "high"
        })
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-github-actions-changed", riskLevel: "high" })],
      securityFindings: [],
      workflowFindings: [workflowFinding({ riskLevel: "high" })]
    });

    assert.equal(result.scoreBreakdown.selectedBand, "workflow");
    assert.equal(result.score, 31);
    assert.notEqual(result.overallRisk, "critical");
  });

  it("does not mark high auth scores as critical without an unconfirmed negative-path finding", () => {
    const result = scoreRisk({
      changedFiles: Array.from({ length: 20 }, (_, index) =>
        changedFile({
          path: `src/auth/file-${index}.ts`,
          category: "security",
          riskLevel: "critical"
        })
      ),
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.ok(result.score <= 60);
    assert.equal(result.overallRisk, "medium");
  });

  it("does not let many test and documentation files inflate production risk heavily", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/api/reservations.ts",
          category: "source",
          riskLevel: "medium"
        }),
        ...Array.from({ length: 25 }, (_, index) =>
          changedFile({
            path: `tests/generated-${index}.test.ts`,
            category: "test",
            riskLevel: "low"
          })
        ),
        ...Array.from({ length: 25 }, (_, index) =>
          changedFile({
            path: `docs/page-${index}.md`,
            category: "documentation",
            riskLevel: "info"
          })
        ),
        changedFile({
          path: "docs/ai-context/CHANGE_LOG.md",
          category: "project-brain",
          riskLevel: "info"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.ok(result.score <= 60);
    assert.equal(result.overallRisk, "medium");
  });

  it("ignores generated Guardian reports in changed-file scoring", () => {
    const withReport = scoreRisk({
      changedFiles: [
        changedFile({
          path: "guardian-report.md",
          category: "generated-report",
          riskLevel: "info"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });
    const withoutReport = scoreRisk({
      changedFiles: [],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.equal(withReport.score, withoutReport.score);
    assert.equal(withReport.overallRisk, withoutReport.overallRisk);
  });

  it("keeps production auth source files meaningful without findings", () => {
    const authResult = scoreRisk({
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
    const docsResult = scoreRisk({
      changedFiles: [
        changedFile({
          path: "README.md",
          category: "documentation",
          riskLevel: "info"
        })
      ],
      qaFindings: [],
      releaseFindings: [],
      securityFindings: []
    });

    assert.ok(authResult.score > docsResult.score);
    assert.equal(authResult.score, 60);
    assert.equal(authResult.overallRisk, "medium");
  });

  it("selects auth band for production auth paths and strong auth filenames", () => {
    for (const path of [
      "src/auth/session.ts",
      "src/security/permissions.ts",
      "src/services/authService.ts",
      "src/pages/login.tsx",
      "src/lib/jwt.ts",
      "src/lib/session.ts",
      "src/lib/permission.ts",
      "src/lib/access-control.ts"
    ]) {
      const result = scoreRisk({
        changedFiles: [
          changedFile({
            path,
            category: path.startsWith("src/auth/") || path.startsWith("src/security/") ? "security" : "source",
            riskLevel: "high"
          })
        ],
        qaFindings: [],
        releaseFindings: [],
        securityFindings: []
      });

      assert.equal(result.scoreBreakdown.selectedBand, "auth", `${path} should select auth band`);
    }
  });

  it("does not select auth band for repository context, config, or workflow files", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({ path: "guardian.config.json", category: "config", riskLevel: "high" }),
        changedFile({ path: ".project-brain/security-rules.md", category: "project-brain", riskLevel: "info" }),
        changedFile({ path: ".project-brain/deployment-rules.md", category: "project-brain", riskLevel: "info" }),
        changedFile({ path: ".project-brain/known-risks.md", category: "project-brain", riskLevel: "info" }),
        changedFile({ path: ".project-brain/module-map.json", category: "project-brain", riskLevel: "info" }),
        changedFile({ path: ".github/workflows/ai-project-guardian.yml", category: "ci", riskLevel: "medium" }),
        changedFile({ path: ".github/workflows/ci.yml", category: "ci", riskLevel: "medium" })
      ],
      qaFindings: [],
      releaseFindings: [releaseFinding({ id: "release-github-actions-changed", riskLevel: "high" })],
      securityFindings: []
    });

    assert.notEqual(result.scoreBreakdown.selectedBand, "auth");
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

  it("marks auth plus no related negative-path test signal as critical", () => {
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

  it("does not apply the auth critical floor when a related test signal exists", () => {
    const result = scoreRisk({
      changedFiles: [
        changedFile({
          path: "src/auth/session.ts",
          category: "security",
          riskLevel: "high"
        }),
        changedFile({
          path: "tests/auth/session.test.ts",
          category: "test",
          riskLevel: "low"
        })
      ],
      qaFindings: [
        qaFinding({
          id: "qa-auth-security-without-negative-test",
          riskLevel: "high",
          testSignalEvidence: {
            changedFiles: ["src/auth/session.ts"],
            expectedTestSignals: ["tests/auth/session.unauthorized.test.ts"],
            detectedTestChanges: ["tests/auth/session.test.ts"],
            detectedRelatedTests: [{ path: "tests/auth/session.test.ts", score: "strong" }],
            detectedCoverageSignals: [],
            unconfirmedCoverageSignals: [],
            suggestedCoverage: ["negative unauthorized path"],
            reason: "Related test changes were detected; review whether they cover the changed behavior."
          }
        })
      ],
      releaseFindings: [],
      securityFindings: []
    });

    assert.notEqual(result.scoreBreakdown.criticalFloorApplied?.applied, true);
    assert.notEqual(result.overallRisk, "critical");
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
      changedFiles: Array.from({ length: 20 }, (_, index) =>
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
      releaseFindings: Array.from({ length: 5 }, () => releaseFinding({ riskLevel: "critical" })),
      securityFindings: Array.from({ length: 5 }, (_, index) => securityFinding({ id: `security-critical-${index}`, riskLevel: "critical" }))
    });

    assert.equal(result.score, 100);
    assert.equal(result.overallRisk, "critical");
  });

  it("returns a score breakdown without changing the calculated score", () => {
    const input = {
      changedFiles: [
        changedFile({
          path: "src/api/reservations.ts",
          category: "source",
          riskLevel: "medium"
        })
      ],
      qaFindings: [qaFinding({ riskLevel: "high" })],
      releaseFindings: [releaseFinding({ riskLevel: "medium" })],
      securityFindings: [securityFinding({ riskLevel: "high" })],
      workflowFindings: [workflowFinding({ riskLevel: "high" })]
    };
    const legacyResult = scoreRisk(input);
    const breakdownResult = calculateRiskScore(input);

    assert.equal(breakdownResult.score, legacyResult.score);
    assert.equal(breakdownResult.overallRisk, legacyResult.overallRisk);
    assert.equal(breakdownResult.scoreBreakdown.selectedBand, "security");
    assert.equal(breakdownResult.scoreBreakdown.changedFileScore, 6);
    assert.equal(breakdownResult.scoreBreakdown.qaFindingScore, 8);
    assert.equal(breakdownResult.scoreBreakdown.releaseFindingScore, 5);
    assert.equal(breakdownResult.scoreBreakdown.securityFindingScore, 18);
    assert.equal(breakdownResult.scoreBreakdown.workflowFindingScore, 10);
    assert.equal(breakdownResult.scoreBreakdown.externalFindingScore, 0);
    assert.equal(breakdownResult.scoreBreakdown.correlatedFindingScore, 0);
    assert.equal(breakdownResult.scoreBreakdown.weightedSignal, 47);
  });

  it("explains the critical floor when a critical combination elevates the score", () => {
    const result = calculateRiskScore({
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
    assert.deepEqual(result.scoreBreakdown.criticalFloorApplied, {
      applied: true,
      floor: 91,
      reason: "Migration changed without DB/integration test coverage"
    });
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

function workflowFinding(overrides: Partial<WorkflowFinding> = {}): WorkflowFinding {
  return {
    id: "workflow-missing-required-check",
    area: "workflow",
    title: "Workflow finding",
    description: "A workflow finding.",
    riskLevel: "low",
    missingCheck: "npm test",
    workflowFile: ".github/workflows/ci.yml",
    recommendation: "Add the missing check.",
    ...overrides
  };
}

function externalFinding(overrides: Partial<ExternalFinding> = {}): ExternalFinding {
  return {
    id: "external-finding",
    source: "semgrep",
    ruleId: "external.rule",
    title: "External finding",
    description: "External finding.",
    riskLevel: "low",
    filePath: "src/api/reservations.ts",
    lineNumber: 12,
    artifactPath: "semgrep.json",
    ...overrides
  };
}
