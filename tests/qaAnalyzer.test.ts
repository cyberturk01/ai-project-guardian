import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeQa } from "../src/analyzers/qaAnalyzer.js";
import { buildActionableGuidance } from "../src/core/actionableGuidance.js";
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
          path: ".project-brain/testing-strategy.md",
          status: "modified",
          category: "project-brain",
          riskLevel: "info"
        }
      ],
      repoFiles: [".project-brain/testing-strategy.md"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("does not create QA findings for docs-only changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "docs/release-process.md",
          status: "modified",
          category: "documentation",
          riskLevel: "info"
        },
        {
          path: "README.md",
          status: "modified",
          category: "documentation",
          riskLevel: "info"
        }
      ],
      repoFiles: ["docs/release-process.md", "README.md"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("does not create QA findings for config-only changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "vite.config.ts",
          status: "modified",
          category: "config",
          riskLevel: "high"
        },
        {
          path: "config/runtime.json",
          status: "modified",
          category: "config",
          riskLevel: "high"
        }
      ],
      repoFiles: ["vite.config.ts", "config/runtime.json"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("does not require nearby tests for CSS-only changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/components/MenuCard.module.css",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/styles/theme.scss",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/styles/legacy.less",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/components/MenuCard.module.css", "src/styles/theme.scss", "src/styles/legacy.less"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("groups repeated component/e2e guidance for many affected UI files", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/components/MenuCard.tsx",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/components/OrderPanel.tsx",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/pages/CheckoutPage.tsx",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/components/MenuCard.tsx", "src/components/OrderPanel.tsx", "src/pages/CheckoutPage.tsx"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const uiFinding = findings.find((finding) => finding.id === "qa-ui-without-cypress-test");
    const guidance = buildActionableGuidance(findings);

    assert.deepEqual(uiFinding?.affectedFiles, [
      "src/components/MenuCard.tsx",
      "src/components/OrderPanel.tsx",
      "src/pages/CheckoutPage.tsx"
    ]);
    assert.deepEqual(uiFinding?.suggestedTests, [
      "Add component tests for touched UI components, or Cypress/e2e coverage for page flows (examples: src/components/MenuCard.tsx, src/components/OrderPanel.tsx, src/pages/CheckoutPage.tsx)."
    ]);
    assert.equal(guidance.filter((item) => item.sourceFindingId === "qa-ui-without-cypress-test").length, 1);
  });

  it("groups repeated nearby test guidance for many affected source files", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/services/menuService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/services/orderService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/domain/pricing.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/services/menuService.ts", "src/services/orderService.ts", "src/domain/pricing.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");
    const guidance = buildActionableGuidance(findings);

    assert.deepEqual(sourceFinding?.affectedFiles, [
      "src/domain/pricing.ts",
      "src/services/menuService.ts",
      "src/services/orderService.ts"
    ]);
    assert.deepEqual(sourceFinding?.suggestedTests, [
      "Create or update nearby unit tests for touched service/business logic files (examples: src/domain/pricing.ts, src/services/menuService.ts, src/services/orderService.ts)."
    ]);
    assert.equal(guidance.filter((item) => item.sourceFindingId === "qa-source-without-nearby-test").length, 1);
  });

  it("suggests component or e2e tests for frontend component changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/components/WalletSummary.tsx",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/components/WalletSummary.tsx"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const uiFinding = findings.find((finding) => finding.id === "qa-ui-without-cypress-test");

    assert.equal(uiFinding?.title, "UI changed without component or e2e coverage");
    assert.deepEqual(uiFinding?.affectedFiles, ["src/components/WalletSummary.tsx"]);
    assert.match(uiFinding?.suggestedTests[0] ?? "", /component tests/);
    assert.match(uiFinding?.suggestedTests[0] ?? "", /Cypress\/e2e/);
  });

  it("suggests API or integration tests for backend API route changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/app/api/wallets/route.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/app/api/wallets/route.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const apiFinding = findings.find((finding) => finding.id === "qa-api-without-integration-test");

    assert.deepEqual(apiFinding?.affectedFiles, ["src/app/api/wallets/route.ts"]);
    assert.match(apiFinding?.suggestedTests[0] ?? "", /API or integration test/);
  });

  it("suggests unit tests for service changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/services/walletHealthService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/services/walletHealthService.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");

    assert.deepEqual(sourceFinding?.affectedFiles, ["src/services/walletHealthService.ts"]);
    assert.equal(
      sourceFinding?.suggestedTests[0],
      "Create or update nearby unit tests for touched service/business logic files (examples: src/services/walletHealthService.ts)."
    );
  });

  it("attaches test signal evidence for changed source files without a nearby test signal", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/services/walletHealthService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/services/walletHealthService.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");

    assert.deepEqual(sourceFinding?.testSignalEvidence?.changedFiles, ["src/services/walletHealthService.ts"]);
    assert.deepEqual(sourceFinding?.testSignalEvidence?.expectedTestSignals, [
      "src/services/walletHealthService.spec.ts",
      "src/services/walletHealthService.test.ts",
      "tests/services/walletHealthService.test.ts",
      "tests/walletHealthService.test.ts"
    ]);
    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedTestChanges, []);
    assert.equal(sourceFinding?.testSignalEvidence?.reason, "No related test change detected.");
  });

  it("adds UI component and e2e test signal evidence for frontend changes", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/components/WalletSummary.tsx",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/components/WalletSummary.tsx"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const uiFinding = findings.find((finding) => finding.id === "qa-ui-without-cypress-test");

    assert.ok(uiFinding?.testSignalEvidence?.expectedTestSignals.includes("src/components/WalletSummary.test.tsx"));
    assert.ok(uiFinding?.testSignalEvidence?.expectedTestSignals.includes("src/components/WalletSummary.spec.tsx"));
    assert.ok(uiFinding?.testSignalEvidence?.expectedTestSignals.includes("cypress/e2e/walletsummary.cy.ts"));
    assert.ok(uiFinding?.testSignalEvidence?.suggestedCoverage.includes("component rendering path"));
    assert.ok(uiFinding?.testSignalEvidence?.suggestedCoverage.includes("validation/error path"));
  });

  it("suggests auth-sensitive coverage without claiming a test is definitely missing", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/admin/tokens.ts",
          status: "modified",
          category: "source",
          riskLevel: "high"
        }
      ],
      repoFiles: ["src/admin/tokens.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.ok(authFinding?.testSignalEvidence?.suggestedCoverage.includes("negative unauthorized path"));
    assert.ok(authFinding?.testSignalEvidence?.suggestedCoverage.includes("role/permission denial"));
    assert.ok(authFinding?.testSignalEvidence?.suggestedCoverage.includes("invalid token/session case"));
    assert.doesNotMatch(authFinding?.testSignalEvidence?.reason ?? "", /overclaiming coverage failure/i);
  });

  it("scores no related test signal for auth-sensitive changes", () => {
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

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.deepEqual(authFinding?.testSignalEvidence?.detectedRelatedTests, []);
    assert.equal(
      authFinding?.description,
      "Auth/security-sensitive files changed. No related test signal was detected, so negative-path coverage could not be confirmed."
    );
  });

  it("scores strong related test signals from source/test filename pairing", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/session.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/auth/session.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/auth/session.ts", "tests/auth/session.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.deepEqual(authFinding?.testSignalEvidence?.detectedRelatedTests, [
      { path: "tests/auth/session.test.ts", score: "strong" }
    ]);
    assert.equal(
      authFinding?.description,
      "Auth/security-sensitive files changed. Related tests were detected, but negative-path coverage was not confirmed."
    );
  });

  it("scores medium related test signals from shared path segments", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/session.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/auth/access.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/auth/session.ts", "tests/auth/access.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.deepEqual(authFinding?.testSignalEvidence?.detectedRelatedTests, [
      { path: "tests/auth/access.test.ts", score: "medium" }
    ]);
  });

  it("scores weak related test signals from shared feature keywords", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/credentialPolicy.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/security/credentialValidation.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/auth/credentialPolicy.ts", "tests/security/credentialValidation.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.deepEqual(authFinding?.testSignalEvidence?.detectedRelatedTests, [
      { path: "tests/security/credentialValidation.test.ts", score: "weak" }
    ]);
    assert.equal(
      authFinding?.testSignalEvidence?.reason,
      "Related test signal is weak; review whether it covers the changed behavior."
    );
    assert.equal(
      authFinding?.description,
      "Auth/security-sensitive files changed. Related test signal is weak; review whether it covers the changed behavior."
    );
  });

  it("suggests business-risk coverage and shows related changed test signals when detected", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/referral/rewardService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "tests/referral/rewardRules.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/referral/rewardService.ts", "tests/referral/rewardRules.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedTestChanges, ["tests/referral/rewardRules.test.ts"]);
    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedRelatedTests, [
      { path: "tests/referral/rewardRules.test.ts", score: "medium" }
    ]);
    assert.ok(sourceFinding?.testSignalEvidence?.suggestedCoverage.includes("duplicate/abuse prevention"));
    assert.ok(sourceFinding?.testSignalEvidence?.suggestedCoverage.includes("limit/quota boundary"));
    assert.ok(sourceFinding?.testSignalEvidence?.suggestedCoverage.includes("invalid input/error path"));
  });

  it("detects happy path coverage signals from changed test content", () => {
    const sourceFinding = findingWithChangedTestContent(`
      it("handles the valid reward request successfully", () => {
        expect(applyReward()).toEqual({ ok: true });
      });
    `);

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedCoverageSignals, ["happy_path"]);
    assert.ok(sourceFinding?.testSignalEvidence?.unconfirmedCoverageSignals.includes("regression"));
  });

  it("detects error path coverage signals from changed test content", () => {
    const sourceFinding = findingWithChangedTestContent(`
      it("rejects invalid reward requests", async () => {
        await expect(applyReward()).rejects.toThrow("invalid reward");
      });
    `);

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedCoverageSignals, ["error_path", "validation"]);
  });

  it("detects regression coverage signals from changed test content", () => {
    const sourceFinding = findingWithChangedTestContent(`
      it("covers the regression for the previously duplicated reward bug", () => {
        expect(applyReward()).toBe("fixed");
      });
    `);

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedCoverageSignals, ["happy_path", "regression"]);
  });

  it("detects output contract coverage signals from changed test content", () => {
    const sourceFinding = findingWithChangedTestContent(`
      it("matches the output contract snapshot", () => {
        expect(renderReward()).toMatchSnapshot();
      });
    `);

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedCoverageSignals, ["output_contract"]);
  });

  it("detects mixed coverage signals without claiming guaranteed coverage", () => {
    const sourceFinding = findingWithChangedTestContent(`
      it("keeps the regression contract for invalid boundary input", () => {
        expect(() => applyReward({ quota: -1 })).toThrow("invalid quota");
      });
      it("denies unauthorized reward access", () => {
        expect(canApplyReward()).toBe(false);
      });
    `);

    assert.deepEqual(sourceFinding?.testSignalEvidence?.detectedCoverageSignals, [
      "happy_path",
      "error_path",
      "regression",
      "output_contract",
      "authorization",
      "validation",
      "boundary"
    ]);
    assert.match(sourceFinding?.testSignalEvidence?.reason ?? "", /review whether they cover/);
    assert.doesNotMatch(sourceFinding?.testSignalEvidence?.reason ?? "", /guaranteed|confirmed/i);
  });

  it("assigns high confidence when QA file, test, and content signals align", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/session.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/auth/session.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/auth/session.ts", "tests/auth/session.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture,
      testFileContents: {
        "tests/auth/session.test.ts": "it('denies unauthorized sessions', () => expect(canAccess()).toBe(false));"
      }
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.ok((authFinding?.confidence ?? 0) >= 80);
  });

  it("assigns moderate confidence when QA relatedness is partial", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/auth/session.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/auth/access.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: ["src/auth/session.ts", "tests/auth/access.test.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const authFinding = findings.find((finding) => finding.id === "qa-auth-security-without-negative-test");

    assert.ok((authFinding?.confidence ?? 0) >= 50);
    assert.ok((authFinding?.confidence ?? 100) < 80);
  });

  it("assigns low confidence and softer wording for broad QA heuristics", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/utils/misc.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/utils/misc.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");

    assert.ok((sourceFinding?.confidence ?? 100) < 50);
    assert.match(sourceFinding?.description ?? "", /Guardian did not find a clear nearby unit test signal/);
  });

  it("groups repeated nearby files into compact expected test signal patterns", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/referral/rewardService.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        },
        {
          path: "src/referral/rewardRules.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/referral/rewardService.ts", "src/referral/rewardRules.ts"],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    const sourceFinding = findings.find((finding) => finding.id === "qa-source-without-nearby-test");

    assert.deepEqual(sourceFinding?.testSignalEvidence?.expectedTestSignals, [
      "cypress/e2e/referral.cy.js",
      "cypress/e2e/referral.cy.ts",
      "e2e/referral.spec.ts",
      "src/referral/*.spec.ts",
      "src/referral/*.test.ts",
      "tests/referral/*"
    ]);
  });

  it("still reports unconfirmed negative-path coverage for real auth and security code", () => {
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
    assert.equal(
      findings.find((finding) => finding.id === "qa-auth-security-without-negative-test")?.title,
      "Auth/security-sensitive files changed; negative-path coverage not confirmed"
    );
  });

  it("does not treat changed test files as uncovered production QA surfaces", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "tests/auth/session.test.ts",
          status: "modified",
          category: "security",
          riskLevel: "high"
        },
        {
          path: "tests/db/migrations/accountMigration.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        },
        {
          path: "tests/i18n/orders.test.ts",
          status: "modified",
          category: "test",
          riskLevel: "low"
        }
      ],
      repoFiles: [
        "tests/auth/session.test.ts",
        "tests/db/migrations/accountMigration.test.ts",
        "tests/i18n/orders.test.ts"
      ],
      config: guardianConfigFixture,
      projectBrain: projectBrainFixture
    });

    assert.deepEqual(findings, []);
  });

  it("adds repository-defined QA findings when matching tests are missing", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/email/sendWelcome.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/email/sendWelcome.ts", "tests/other.test.ts"],
      config: {
        ...guardianConfigFixture,
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "src/email/**",
            requiresTest: "tests/email/**",
            risk: "high"
          }
        ]
      },
      projectBrain: projectBrainFixture
    });

    const customFinding = findings.find((finding) => finding.id === "email-change-requires-test");

    assert.equal(customFinding?.riskLevel, "high");
    assert.deepEqual(customFinding?.affectedFiles, ["src/email/sendWelcome.ts"]);
    assert.match(customFinding?.suggestedTests[0] ?? "", /tests\/email\/\*\*/);
  });

  it("suppresses repository-defined QA findings when matching tests exist", () => {
    const findings = analyzeQa({
      changedFiles: [
        {
          path: "src/email/sendWelcome.ts",
          status: "modified",
          category: "source",
          riskLevel: "medium"
        }
      ],
      repoFiles: ["src/email/sendWelcome.ts", "tests/email/sendWelcome.test.ts"],
      config: {
        ...guardianConfigFixture,
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "src/email/**",
            requiresTest: "tests/email/**",
            risk: "high"
          }
        ]
      },
      projectBrain: projectBrainFixture
    });

    assert.ok(!findings.some((finding) => finding.id === "email-change-requires-test"));
  });
});

function findingWithChangedTestContent(content: string) {
  const findings = analyzeQa({
    changedFiles: [
      {
        path: "src/referral/rewardService.ts",
        status: "modified",
        category: "source",
        riskLevel: "medium"
      },
      {
        path: "tests/referral/rewardRules.test.ts",
        status: "modified",
        category: "test",
        riskLevel: "low"
      }
    ],
    repoFiles: ["src/referral/rewardService.ts", "tests/referral/rewardRules.test.ts"],
    config: guardianConfigFixture,
    projectBrain: projectBrainFixture,
    testFileContents: {
      "tests/referral/rewardRules.test.ts": content
    }
  });

  return findings.find((finding) => finding.id === "qa-source-without-nearby-test");
}
