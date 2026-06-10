import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { runGuardianCli, shouldFailBuild } from "../src/cli/runGuardian.js";

const execFileAsync = promisify(execFile);

describe("runGuardianCli integration", () => {
  it("runs against a fixture repository and writes a markdown report without failing by default", async () => {
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
      assert.match(report, /# AI Project Guardian Report/);
      assert.match(report, /\| Overall risk \| \*\*critical\*\* \|/);
      assert.match(report, /src\/auth\/session.ts/);
      assert.match(report, /db\/migrations\/001_add_sessions.sql/);
    });
  });

  it("returns exit 1 when --fail-on high sees high or critical risk", async () => {
    await withFixtureRepo(async (repoPath) => {
      const outputPath = join(repoPath, "guardian-report.md");
      const stdout = new MemoryWritable();

      const result = await runGuardianCli({
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--fail-on", "high"],
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
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.match(report, /Business area changed with required deploy checks: order fulfillment/);
      assert.match(report, /- \[ \] Confirm fulfillment queue processing before deploy/);
      assert.match(report, /## Required Actions[\s\S]*Confirm fulfillment queue processing before deploy/);
    });
  });

  it("excludes accepted findings from the overall score while showing them separately", async () => {
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
        argv: ["--repo", repoPath, "--base", "origin/main", "--out", outputPath, "--fail-on", "high"],
        stdout
      });

      const report = await readFile(outputPath, "utf8");

      assert.equal(result.exitCode, 0);
      assert.equal(result.overallRisk, "low");
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

async function createFixtureRepo(repoPath: string): Promise<void> {
  await git(repoPath, "init");
  await git(repoPath, "config", "user.email", "guardian@example.com");
  await git(repoPath, "config", "user.name", "Guardian Test");
  await mkdir(join(repoPath, "src", "auth"), { recursive: true });
  await mkdir(join(repoPath, "db", "migrations"), { recursive: true });
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
