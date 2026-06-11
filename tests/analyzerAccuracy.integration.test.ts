import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "../src/config/loadConfig.js";
import { runGuardian } from "../src/core/guardian.js";
import type { GuardianFinding, GuardianReport, RiskLevel } from "../src/core/types.js";

const execFileAsync = promisify(execFile);
const fixturesRoot = join(process.cwd(), "tests", "test-fixtures", "analyzer-accuracy");

type AccuracyManifest = {
  name: string;
  expectedRisk: RiskLevel;
  expectedFindings: string[];
  unexpectedFindings: string[];
};

const fixtureNames = [
  "auth-change-without-tests",
  "migration-change-without-db-tests",
  "workflow-change",
  "hardcoded-secret",
  "docs-only-change",
  "config-only-change"
] as const;

describe("analyzer accuracy fixtures", () => {
  for (const fixtureName of fixtureNames) {
    it(`matches expected findings and risk for ${fixtureName}`, async () => {
      const manifest = await readManifest(fixtureName);

      await withAccuracyFixtureRepo(fixtureName, async (repoPath) => {
        const report = await runGuardian(
          loadConfig({
            repoPath,
            baseRef: "origin/main",
            format: "markdown"
          })
        );
        const findingIds = collectFindingIds(report);

        for (const expectedFinding of manifest.expectedFindings) {
          assert.ok(
            findingIds.includes(expectedFinding),
            `${manifest.name} should include expected finding ${expectedFinding}; got ${findingIds.join(", ")}`
          );
        }

        for (const unexpectedFinding of manifest.unexpectedFindings) {
          assert.ok(
            !findingIds.includes(unexpectedFinding),
            `${manifest.name} should not include unexpected finding ${unexpectedFinding}; got ${findingIds.join(", ")}`
          );
        }

        assert.equal(report.overallRisk, manifest.expectedRisk);
      });
    });
  }
});

async function readManifest(fixtureName: string): Promise<AccuracyManifest> {
  return JSON.parse(await readFile(join(fixturesRoot, fixtureName, "manifest.json"), "utf8")) as AccuracyManifest;
}

async function withAccuracyFixtureRepo(fixtureName: string, test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), `guardian-accuracy-${fixtureName}-`));
  const fixturePath = join(fixturesRoot, fixtureName);

  try {
    await cp(join(fixturePath, "baseline"), repoPath, { recursive: true });
    await git(repoPath, "init");
    await git(repoPath, "config", "user.email", "guardian@example.com");
    await git(repoPath, "config", "user.name", "Guardian Test");
    await git(repoPath, "add", ".");
    await git(repoPath, "commit", "-m", "Baseline fixture");
    await git(repoPath, "update-ref", "refs/remotes/origin/main", "HEAD");

    await cp(join(fixturePath, "head"), repoPath, { recursive: true });
    await git(repoPath, "add", ".");
    await git(repoPath, "commit", "-m", "Fixture change");

    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

function collectFindingIds(report: GuardianReport): string[] {
  const findings: GuardianFinding[] = [
    ...report.qaFindings,
    ...report.releaseFindings,
    ...report.securityFindings,
    ...report.workflowFindings
  ];

  return findings.map((finding) => finding.id).sort((left, right) => left.localeCompare(right));
}
