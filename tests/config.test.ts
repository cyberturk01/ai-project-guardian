import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { loadConfig } from "../src/config/loadConfig.js";
import { loadGuardianConfig } from "../src/config/guardianConfig.js";

describe("loadConfig", () => {
  it("loads defaults for the CLI scaffold", () => {
    const config = loadConfig({});

    assert.equal(config.format, "markdown");
    assert.equal(config.repoPath, process.cwd());
    assert.equal(config.outputPath, undefined);
  });

  it("resolves relative repository and output paths", () => {
    const config = loadConfig({
      repoPath: ".",
      baseRef: "origin/main",
      outputPath: "guardian-report.md"
    });

    assert.equal(config.repoPath, process.cwd());
    assert.equal(config.baseRef, "origin/main");
    assert.equal(config.outputPath, join(process.cwd(), "guardian-report.md"));
    assert.ok(isAbsolute(config.repoPath));
    assert.ok(isAbsolute(config.outputPath));
  });

  it("rejects unsupported report formats", () => {
    assert.throws(() => loadConfig({ format: "html" }), /Unsupported report format/);
  });

  it("loads SARIF as a supported report format", () => {
    const config = loadConfig({ format: "sarif" });

    assert.equal(config.format, "sarif");
  });

  it("resolves local external scanner artifact paths", () => {
    const config = loadConfig({
      sarifPaths: ["reports/generic.sarif"],
      codeqlPaths: ["reports/codeql.sarif"],
      semgrepPaths: ["reports/semgrep.json"],
      snykPaths: ["reports/snyk.json"]
    });

    assert.deepEqual(config.externalArtifacts, {
      sarif: [join(process.cwd(), "reports/generic.sarif")],
      codeql: [join(process.cwd(), "reports/codeql.sarif")],
      semgrep: [join(process.cwd(), "reports/semgrep.json")],
      snyk: [join(process.cwd(), "reports/snyk.json")]
    });
  });
});

describe("loadGuardianConfig", () => {
  it("loads a valid config from the target repository root", () => {
    const repoPath = makeRepo();
    writeFileSync(
      join(repoPath, "guardian.config.json"),
      JSON.stringify({
        projectName: "AI Restaurants",
        riskFolders: ["src/api"],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: ["npm test"],
        coverageThreshold: 75,
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "src/email/**",
            requiresTest: "tests/email/**",
            risk: "high"
          },
          {
            id: "deploy-config-review",
            whenChanged: "config/deploy/**",
            risk: "medium",
            requiredBeforeDeploy: ["Review deploy config with release owner"]
          }
        ],
        businessAreas: [
          {
            name: "consent",
            description: "Consent flow",
            riskLevel: "high",
            paths: ["src/consent"],
            requiredTestHints: ["consent"],
            requiredBeforeDeploy: ["Confirm consent audit evidence is still written"]
          }
        ]
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.deepEqual(result, {
      config: {
        projectName: "AI Restaurants",
        riskFolders: ["src/api"],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: ["npm test"],
        coverageThreshold: 75,
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "src/email/**",
            requiresTest: "tests/email/**",
            risk: "high",
            title: undefined,
            description: undefined,
            requiredBeforeDeploy: undefined,
            whyItMatters: undefined
          },
          {
            id: "deploy-config-review",
            whenChanged: "config/deploy/**",
            requiresTest: undefined,
            risk: "medium",
            title: undefined,
            description: undefined,
            requiredBeforeDeploy: ["Review deploy config with release owner"],
            whyItMatters: undefined
          }
        ],
        businessAreas: [
          {
            name: "consent",
            description: "Consent flow",
            riskLevel: "high",
            paths: ["src/consent"],
            requiredTestHints: ["consent"],
            requiredBeforeDeploy: ["Confirm consent audit evidence is still written"]
          }
        ]
      },
      warnings: []
    });
  });

  it("normalizes config paths relative to the target repository", () => {
    const repoPath = makeRepo();
    writeFileSync(
      join(repoPath, "guardian.config.json"),
      JSON.stringify({
        riskFolders: ["src/api", "./src/auth"],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["../shared/package.json"],
        requiredChecks: ["npm test"],
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "./src/email/**",
            requiresTest: "./tests/email/**",
            risk: "high"
          }
        ],
        businessAreas: [
          {
            name: "privacy",
            riskLevel: "high",
            paths: ["src/privacy", "./src/consent"]
          }
        ]
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.deepEqual(result.config.riskFolders, ["src/api", "src/auth"]);
    assert.deepEqual(result.config.testFolders, ["tests"]);
    assert.deepEqual(result.config.releaseSensitiveFiles, ["../shared/package.json"]);
    assert.deepEqual(result.config.requiredChecks, ["npm test"]);
    assert.equal(result.config.coverageThreshold, 80);
    assert.deepEqual(result.config.customRules?.[0].whenChanged, "src/email/**");
    assert.deepEqual(result.config.customRules?.[0].requiresTest, "tests/email/**");
    assert.deepEqual(result.config.businessAreas?.[0].paths, ["src/privacy", "src/consent"]);
  });

  it("uses defaults and warns when config is missing", () => {
    const result = loadGuardianConfig(makeRepo());

    assert.equal(result.config.projectName, "ai-project-guardian");
    assert.deepEqual(result.config.riskFolders, []);
    assert.deepEqual(result.config.businessAreas, []);
    assert.deepEqual(result.config.customRules, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /not found/);
  });

  it("uses safe defaults and warnings for invalid config", () => {
    const repoPath = makeRepo();
    writeFileSync(
      join(repoPath, "guardian.config.json"),
      JSON.stringify({
        projectName: 42,
        riskFolders: ["src", 42],
        testFolders: "tests",
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: ["npm test"],
        coverageThreshold: 101,
        businessAreas: [
          {
            name: "consent",
            riskLevel: "high",
            paths: ["src/consent"]
          },
          {
            name: "",
            riskLevel: "high",
            paths: ["src/email"]
          },
          {
            name: "referral",
            riskLevel: "urgent",
            paths: ["src/referral"]
          },
          {
            name: "i18n",
            riskLevel: "medium",
            paths: "src/i18n"
          }
        ],
        customRules: [
          {
            id: "email-change-requires-test",
            whenChanged: "src/email/**",
            requiresTest: "tests/email/**",
            risk: "high"
          },
          {
            id: "",
            whenChanged: "src/billing/**",
            requiresTest: "tests/billing/**",
            risk: "high"
          },
          {
            id: "release-review",
            whenChanged: "config/release/**",
            risk: "severe",
            requiredBeforeDeploy: ["Review release config"]
          },
          {
            id: "empty-rule",
            whenChanged: "src/empty/**",
            risk: "low"
          }
        ],
        extraField: true
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.equal(result.config.projectName, "ai-project-guardian");
    assert.deepEqual(result.config.riskFolders, []);
    assert.deepEqual(result.config.testFolders, []);
    assert.deepEqual(result.config.releaseSensitiveFiles, ["package.json"]);
    assert.deepEqual(result.config.requiredChecks, ["npm test"]);
    assert.equal(result.config.coverageThreshold, 80);
    assert.deepEqual(result.config.businessAreas, [
      {
        name: "consent",
        riskLevel: "high",
        paths: ["src/consent"],
        requiredTestHints: undefined,
        requiredBeforeDeploy: undefined,
        description: undefined
      }
    ]);
    assert.deepEqual(result.config.customRules, [
      {
        id: "email-change-requires-test",
        whenChanged: "src/email/**",
        requiresTest: "tests/email/**",
        risk: "high",
        title: undefined,
        description: undefined,
        requiredBeforeDeploy: undefined,
        whyItMatters: undefined
      }
    ]);
    assert.equal(result.warnings.length, 11);
  });

  it("warns and continues when businessAreas is invalid", () => {
    const repoPath = makeRepo();
    writeFileSync(
      join(repoPath, "guardian.config.json"),
      JSON.stringify({
        projectName: "Invalid Business Areas",
        businessAreas: "consent"
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.deepEqual(result.config.businessAreas, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /businessAreas/);
  });

  it("warns and continues when customRules is invalid", () => {
    const repoPath = makeRepo();
    writeFileSync(
      join(repoPath, "guardian.config.json"),
      JSON.stringify({
        projectName: "Invalid Custom Rules",
        customRules: "email"
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.deepEqual(result.config.customRules, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /customRules/);
  });
});

function makeRepo(): string {
  return mkdtempSync(join(tmpdir(), "guardian-config-test-"));
}
