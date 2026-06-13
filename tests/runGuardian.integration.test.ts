import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { runGuardianCli, shouldFailBuild } from "../src/cli/runGuardian.js";
import type { GuardianReport } from "../src/core/types.js";

const execFileAsync = promisify(execFile);

describe("runGuardianCli integration", () => {
  it("runs against a fixture repository and writes a summary report without failing by default", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "critical");
      assert.match(stdout.value, /Guardian report written to/);
      assert.match(report, /# AI Project Guardian Summary/);
      assert.match(report, /\| Overall risk \| \*\*critical\*\* \|/);
      assert.match(report, /Run with `--full-report`/);
      assert.doesNotMatch(report, /## Changed Files/);
    });
  });

  it("writes the complete markdown report when --full-report is set", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "critical");
      assert.match(report, /# AI Project Guardian Report/);
      assert.match(report, /\| Overall risk \| \*\*critical\*\* \|/);
      assert.match(report, /src\/auth\/session.ts/);
      assert.match(report, /db\/migrations\/001_add_sessions.sql/);
    });
  });

  it("writes a GitHub PR comment markdown summary when --pr-comment is set", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-pr-comment.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--pr-comment"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "critical");
      assert.match(report, /^### AI Project Guardian/);
      assert.match(report, /\| Risk score \| \d+\/100 \|/);
      assert.match(report, /\| Overall risk \| \*\*critical\*\* \|/);
      assert.match(report, /\*\*Top Findings\*\*/);
      assert.match(report, /\*\*Actionable Guidance\*\*/);
      assert.match(report, /\*\*Required Deploy Actions\*\*/);
      assert.match(report, /- \[ \] /);
      assert.doesNotMatch(report, /## Changed Files/);
    });
  });

  it("returns exit 1 when --fail-on high sees high or critical risk", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report", "--fail-on", "high"],
        stdout
      });

      assert.equal(result.exitCode, 1);
      assert.equal(result.overallRisk, "critical");
      assert.match(await readFile(outputPath, "utf8"), /Highest detected risk: \*\*critical\*\*/);
    });
  });

  it("adds business area requiredBeforeDeploy items to report actions", async () => {
    await withBusinessAreaFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.match(report, /Business area changed with required deploy checks: order fulfillment/);
      assert.match(report, /- \[ \] Confirm fulfillment queue processing before deploy/);
      assert.match(report, /## Required Deploy Actions[\s\S]*Confirm fulfillment queue processing before deploy/);
      assert.match(report, /## Actionable Guidance[\s\S]*Confirm fulfillment queue processing before deploy/);
    });
  });

  it("keeps release-only findings as checklist items in the generated report object", async () => {
    await withReleaseOnlyFixtureRepo(async (repoPath) => {
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--format", "json"],
        stdout
      });

      const report = JSON.parse(stdout.value) as GuardianReport;

      assert.equal(report.blockingFindingsCount, 0);
      assert.ok(report.checklistFindingsCount > 0);
      assert.equal(report.mergeRecommendation, "safe_after_checklist");
      assert.equal(report.riskReason, "Only release checklist items remain.");
      assert.ok(report.releaseFindings.length > 0);
      assert.ok(report.requiredDeployActions.length > 0);
      assert.ok(report.actionableGuidance.some((item) => item.area === "release"));
      assert.equal(report.qaFindings.length, 0);
      assert.equal(report.securityFindings.length, 0);
      assert.equal(report.workflowFindings.length, 0);
    });
  });

  it("blocks auth changes when negative test coverage is missing", async () => {
    await withAuthFixtureRepo({ hasNegativeTest: false, changeReleaseFile: false }, async (repoPath) => {
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--format", "json"],
        stdout
      });

      const report = JSON.parse(stdout.value) as GuardianReport;

      assert.equal(report.overallRisk, "critical");
      assert.equal(report.mergeRecommendation, "blocked");
      assert.equal(report.codeRisk, "high");
      assert.equal(report.riskReason, "Auth/security changed without negative test coverage.");
      assert.ok(report.qaFindings.some((finding) => finding.id === "qa-auth-security-without-negative-test"));
      assert.equal(report.securityFindings.length, 0);
    });
  });

  it("calibrates auth changes after negative test coverage exists", async () => {
    await withAuthFixtureRepo({ hasNegativeTest: true, changeReleaseFile: true }, async (repoPath) => {
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--format", "json"],
        stdout
      });

      const report = JSON.parse(stdout.value) as GuardianReport;

      assert.equal(report.blockingFindingsCount, 0);
      assert.ok(report.checklistFindingsCount > 0);
      assert.equal(report.mergeRecommendation, "safe_after_checklist");
      assert.equal(report.codeRisk, "medium");
      assert.equal(report.riskReason, "Only release checklist items remain.");
      assert.equal(report.qaFindings.length, 0);
      assert.equal(report.securityFindings.length, 0);
      assert.equal(report.workflowFindings.length, 0);
    });
  });

  it("keeps actual security findings blocked even when negative tests exist", async () => {
    await withAuthFixtureRepo({ hasNegativeTest: true, changeReleaseFile: false, introduceSecurityFinding: true }, async (repoPath) => {
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--format", "json"],
        stdout
      });

      const report = JSON.parse(stdout.value) as GuardianReport;

      assert.equal(report.mergeRecommendation, "blocked");
      assert.equal(report.codeRisk, "high");
      assert.equal(report.riskReason, "Security findings require review.");
      assert.equal(report.qaFindings.length, 0);
      assert.ok(report.securityFindings.length > 0);
    });
  });

  it("reports required checks missing from GitHub Actions workflows", async () => {
    await withFixtureRepo(async (repoPath) => {
      await writeFile(
        join(repoPath, "guardian.config.json"),
        JSON.stringify(
          {
            projectName: "Fixture Repo",
            riskFolders: ["src/auth"],
            testFolders: ["tests"],
            releaseSensitiveFiles: ["package.json"],
            requiredChecks: ["npm test", "npm run lint"]
          },
          null,
          2
        ),
        "utf8"
      );
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.match(report, /## Workflow Findings/);
      assert.match(report, /Required workflow check is missing/);
      assert.match(report, /npm run lint/);
      assert.match(report, /\.github\/workflows\/ci.yml/);
    });
  });

  it("reports changed code below optional coverage threshold when coverage output is present", async () => {
    await withFixtureRepo(async (repoPath) => {
      await writeFile(
        join(repoPath, "guardian.config.json"),
        JSON.stringify(
          {
            projectName: "Fixture Repo",
            riskFolders: ["src/auth"],
            testFolders: ["tests"],
            releaseSensitiveFiles: ["package.json"],
            requiredChecks: ["npm test"],
            coverageThreshold: 90
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(repoPath, "coverage-final.json"),
        JSON.stringify(
          {
            "src/auth/session.ts": {
              s: {
                "0": 1,
                "1": 0
              }
            }
          },
          null,
          2
        ),
        "utf8"
      );
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.match(report, /Changed code has low test coverage/);
      assert.match(report, /src\/auth\/session.ts/);
      assert.match(report, /90%/);
    });
  });

  it("writes SARIF when --format sarif is set", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.sarif");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--format", "sarif"],
        stdout
      });
      const sarif = JSON.parse(await readFile(outputPath, "utf8")) as {
        version: string;
        runs: Array<{
          tool: { driver: { rules: Array<{ id: string }> } };
          results: Array<{ ruleId: string }>;
        }>;
      };

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "critical");
      assert.equal(sarif.version, "2.1.0");
      assert.ok(sarif.runs[0].tool.driver.rules.some((rule) => rule.id === "security-hardcoded-secret"));
      assert.ok(sarif.runs[0].results.some((sarifResult) => sarifResult.ruleId === "security-hardcoded-secret"));
      assert.match(stdout.value, /Guardian report written to/);
    });
  });

  it("imports local scanner artifacts into the unified full report", async () => {
    await withFixtureRepo(async (repoPath) => {
      const semgrepPath = join(repoPath, "semgrep.json");
      await writeFile(
        semgrepPath,
        JSON.stringify(
          {
            results: [
              {
                check_id: "generic.secrets.security.detected-secret",
                path: "src/auth/session.ts",
                start: { line: 2 },
                extra: {
                  message: "Possible hardcoded secret",
                  severity: "ERROR"
                }
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report", "--semgrep", semgrepPath],
        stdout
      });
      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "critical");
      assert.match(report, /## Enterprise Risk Correlation/);
      assert.match(report, /External scanner findings \| 1/);
      assert.match(report, /Multi-tool correlations \| 1/);
      assert.match(report, /guardian, semgrep/);
      assert.match(report, /generic\.secrets\.security\.detected-secret/);
    });
  });

  it("excludes accepted findings from critical combinations while showing them separately", async () => {
    await withFixtureRepo(async (repoPath) => {
      await writeFile(
        join(repoPath, ".guardian-baseline.json"),
        JSON.stringify(
          {
            acceptedFindings: [
              {
                type: "qa",
                title: "Auth or security changed without negative test coverage"
              },
              {
                type: "qa",
                title: "Migration changed without DB/integration test coverage"
              },
              {
                type: "release",
                title: "Database migration changed"
              },
              {
                type: "release",
                title: "Package dependency changed"
              },
              {
                type: "security",
                title: "Possible hardcoded secret"
              }
            ]
          },
          null,
          2
        ),
        "utf8"
      );
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--full-report", "--fail-on", "critical"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "medium");
      assert.match(report, /## Accepted Findings/);
      assert.match(report, /Possible hardcoded secret/);
      assert.match(report, /These findings matched `\.guardian-baseline\.json`/);
    });
  });
});

describe("shouldFailBuild", () => {
  it("does not fail the build by default", () => {
    assert.equal(shouldFailBuild(undefined, "critical"), false);
  });

  it("fails on high when risk is high or critical", () => {
    assert.equal(shouldFailBuild("high", "high"), true);
    assert.equal(shouldFailBuild("high", "critical"), true);
  });

  it("fails on critical only when risk is critical", () => {
    assert.equal(shouldFailBuild("critical", "high"), false);
    assert.equal(shouldFailBuild("critical", "critical"), true);
  });
});

async function withFixtureRepo(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-fixture-"));

  try {
    await createFixtureRepo(repoPath);
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function withBusinessAreaFixtureRepo(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-business-area-fixture-"));

  try {
    await createBusinessAreaFixtureRepo(repoPath);
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function withAuthFixtureRepo(
  options: { hasNegativeTest: boolean; changeReleaseFile: boolean; introduceSecurityFinding?: boolean },
  test: (repoPath: string) => Promise<void>
): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-auth-fixture-"));

  try {
    await createAuthFixtureRepo(repoPath, options);
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function withReleaseOnlyFixtureRepo(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-release-only-fixture-"));

  try {
    await createReleaseOnlyFixtureRepo(repoPath);
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function createFixtureRepo(repoPath: string): Promise<void> {
  await git(repoPath, "init");
  await git(repoPath, "config", "user.email", "guardian@example.com");
  await git(repoPath, "config", "user.name", "Guardian Test");
  await mkdir(join(repoPath, "src", "auth"), { recursive: true });
  await mkdir(join(repoPath, "db", "migrations"), { recursive: true });
  await mkdir(join(repoPath, ".github", "workflows"), { recursive: true });
  await writeFile(
    join(repoPath, "guardian.config.json"),
    JSON.stringify(
      {
        projectName: "Fixture Repo",
        riskFolders: ["src/auth"],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: ["npm test"]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "fixture-repo", version: "1.0.0" }, null, 2), "utf8");
  await writeFile(
    join(repoPath, ".github", "workflows", "ci.yml"),
    [
      "name: CI",
      "on: [pull_request]",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - run: npm test",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(repoPath, "README.md"), "# Fixture Repo\n", "utf8");
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Initial fixture");
  await git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

  await writeFile(
    join(repoPath, "src", "auth", "session.ts"),
    [
      "export function createSession() {",
      "  const accessTokenSecret = \"realSecretValue12345\";",
      "  return accessTokenSecret;",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(repoPath, "db", "migrations", "001_add_sessions.sql"), "create table sessions (id text primary key);\n", "utf8");
  await writeFile(
    join(repoPath, "package.json"),
    JSON.stringify({ name: "fixture-repo", version: "1.0.1", dependencies: { express: "^4.18.0" } }, null, 2),
    "utf8"
  );
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Risky fixture changes");
}

async function createBusinessAreaFixtureRepo(repoPath: string): Promise<void> {
  await git(repoPath, "init");
  await git(repoPath, "config", "user.email", "guardian@example.com");
  await git(repoPath, "config", "user.name", "Guardian Test");
  await mkdir(join(repoPath, "src", "fulfillment"), { recursive: true });
  await mkdir(join(repoPath, "tests"), { recursive: true });
  await writeFile(
    join(repoPath, "guardian.config.json"),
    JSON.stringify(
      {
        projectName: "Business Area Fixture",
        testFolders: ["tests"],
        businessAreas: [
          {
            name: "order fulfillment",
            description: "Order queue and fulfillment handoff",
            riskLevel: "high",
            paths: ["src/fulfillment"],
            requiredTestHints: ["fulfillment"],
            requiredBeforeDeploy: ["Confirm fulfillment queue processing before deploy"]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(repoPath, "src", "fulfillment", "queue.ts"), "export const queue = [];\n", "utf8");
  await writeFile(join(repoPath, "tests", "fulfillment.test.ts"), "import 'node:test';\n", "utf8");
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Initial business area fixture");
  await git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

  await writeFile(join(repoPath, "src", "fulfillment", "queue.ts"), "export const queue = ['changed'];\n", "utf8");
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Change fulfillment queue");
}

async function createAuthFixtureRepo(
  repoPath: string,
  options: { hasNegativeTest: boolean; changeReleaseFile: boolean; introduceSecurityFinding?: boolean }
): Promise<void> {
  await git(repoPath, "init");
  await git(repoPath, "config", "user.email", "guardian@example.com");
  await git(repoPath, "config", "user.name", "Guardian Test");
  await mkdir(join(repoPath, "src", "auth"), { recursive: true });
  await mkdir(join(repoPath, "tests", "auth"), { recursive: true });
  await writeFile(
    join(repoPath, "guardian.config.json"),
    JSON.stringify(
      {
        projectName: "Auth Fixture",
        riskFolders: ["src/auth"],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: []
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "auth-fixture", version: "1.0.0" }, null, 2), "utf8");
  await writeFile(
    join(repoPath, "src", "auth", "session.ts"),
    ["export function canAccessSession(userRole: string) {", "  return userRole === 'admin';", "}", ""].join("\n"),
    "utf8"
  );

  if (options.hasNegativeTest) {
    await writeFile(
      join(repoPath, "tests", "auth", "session.unauthorized.test.ts"),
      ["import { test } from 'node:test';", "test('denies unauthorized session access', () => {});", ""].join("\n"),
      "utf8"
    );
  }

  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Initial auth fixture");
  await git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

  await writeFile(
    join(repoPath, "src", "auth", "session.ts"),
    [
      "export function canAccessSession(userRole: string) {",
      options.introduceSecurityFinding === true ? "  const authOptions = { requireAuth: false };" : "  return userRole === 'admin' || userRole === 'support';",
      options.introduceSecurityFinding === true ? "  return authOptions.requireAuth;" : undefined,
      "}",
      ""
    ].filter((line): line is string => line !== undefined).join("\n"),
    "utf8"
  );

  if (options.changeReleaseFile) {
    await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "auth-fixture", version: "1.0.1" }, null, 2), "utf8");
  }

  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Change auth fixture");
}

async function createReleaseOnlyFixtureRepo(repoPath: string): Promise<void> {
  await git(repoPath, "init");
  await git(repoPath, "config", "user.email", "guardian@example.com");
  await git(repoPath, "config", "user.name", "Guardian Test");
  await writeFile(
    join(repoPath, "guardian.config.json"),
    JSON.stringify(
      {
        projectName: "Release Only Fixture",
        riskFolders: [],
        testFolders: ["tests"],
        releaseSensitiveFiles: ["package.json"],
        requiredChecks: []
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "release-only", version: "1.0.0" }, null, 2), "utf8");
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Initial release-only fixture");
  await git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

  await writeFile(join(repoPath, "package.json"), JSON.stringify({ name: "release-only", version: "1.0.1" }, null, 2), "utf8");
  await git(repoPath, "add", ".");
  await git(repoPath, "commit", "-m", "Release-only package change");
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

class MemoryWritable extends Writable {
  value = "";

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.value += chunk.toString();
    callback();
  }
}
