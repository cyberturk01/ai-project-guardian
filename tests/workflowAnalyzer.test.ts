import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeWorkflows, extractWorkflowCommands } from "../src/analyzers/workflowAnalyzer.js";
import type { GuardianConfig } from "../src/core/types.js";

describe("extractWorkflowCommands", () => {
  it("extracts inline and block run commands from GitHub workflow YAML", () => {
    const commands = extractWorkflowCommands([
      "name: CI",
      "jobs:",
      "  test:",
      "    steps:",
      "      - run: npm ci",
      "      - run: npm test && npm run lint",
      "      - run: |",
      "          npm run build",
      "          npm run typecheck",
      ""
    ].join("\n"));

    assert.deepEqual(commands, ["npm ci", "npm test", "npm run lint", "npm run build", "npm run typecheck"]);
  });
});

describe("analyzeWorkflows", () => {
  it("creates a workflow finding for each required check missing from GitHub Actions", async () => {
    await withRepo(async (repoPath) => {
      await mkdir(join(repoPath, ".github", "workflows"), { recursive: true });
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

      const findings = await analyzeWorkflows({
        repoPath,
        repoFiles: [".github/workflows/ci.yml"],
        config: configWithRequiredChecks(["npm test", "npm run lint"])
      });

      assert.equal(findings.length, 1);
      assert.deepEqual(findings[0], {
        id: "workflow-missing-required-check-npm-run-lint",
        area: "workflow",
        title: "Required workflow check is missing",
        description: "No GitHub Actions workflow command runs the required check: npm run lint.",
        riskLevel: "high",
        missingCheck: "npm run lint",
        workflowFile: ".github/workflows/ci.yml",
        recommendation: "Add the required check to a GitHub Actions workflow that runs before merge or release."
      });
    });
  });

  it("does not create findings when required checks run in workflow commands", async () => {
    await withRepo(async (repoPath) => {
      await mkdir(join(repoPath, ".github", "workflows"), { recursive: true });
      await writeFile(
        join(repoPath, ".github", "workflows", "ci.yaml"),
        [
          "name: CI",
          "jobs:",
          "  test:",
          "    steps:",
          "      - run: |",
          "          npm test -- --coverage",
          "          npm run lint",
          ""
        ].join("\n"),
        "utf8"
      );

      const findings = await analyzeWorkflows({
        repoPath,
        repoFiles: [".github/workflows/ci.yaml"],
        config: configWithRequiredChecks(["npm test", "npm run lint"])
      });

      assert.deepEqual(findings, []);
    });
  });

  it("does not create findings when a workflow delegates required checks to a package script", async () => {
    await withRepo(async (repoPath) => {
      await mkdir(join(repoPath, ".github", "workflows"), { recursive: true });
      await mkdir(join(repoPath, "scripts"), { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            scripts: {
              "release:check": "node scripts/release-check.js"
            }
          },
          null,
          2
        ),
        "utf8"
      );
      await writeFile(
        join(repoPath, "scripts", "release-check.js"),
        [
          "const checks = [",
          "  'npm test',",
          "  'npm pack --dry-run'",
          "];",
          "console.log(checks.join('\\n'));",
          ""
        ].join("\n"),
        "utf8"
      );
      await writeFile(
        join(repoPath, ".github", "workflows", "ci.yml"),
        [
          "name: CI",
          "jobs:",
          "  test:",
          "    steps:",
          "      - run: npm run release:check",
          ""
        ].join("\n"),
        "utf8"
      );

      const findings = await analyzeWorkflows({
        repoPath,
        repoFiles: [".github/workflows/ci.yml", "package.json", "scripts/release-check.js"],
        config: configWithRequiredChecks(["npm test", "npm pack --dry-run"])
      });

      assert.deepEqual(findings, []);
    });
  });
});

async function withRepo(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-workflow-test-"));

  try {
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

function configWithRequiredChecks(requiredChecks: string[]): GuardianConfig {
  return {
    projectName: "Workflow Fixture",
    riskFolders: [],
    testFolders: [],
    releaseSensitiveFiles: [],
    requiredChecks,
    coverageThreshold: 80,
    businessAreas: []
  };
}
