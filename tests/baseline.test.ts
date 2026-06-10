import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyBaseline, loadBaseline } from "../src/core/baseline.js";
import type { GuardianFinding, ReleaseFinding, WorkflowFinding } from "../src/core/types.js";

describe("loadBaseline", () => {
  it("returns an empty baseline when .guardian-baseline.json is missing", async () => {
    await withTempDir(async (repoPath) => {
      const result = await loadBaseline(repoPath);

      assert.deepEqual(result.baseline, { acceptedFindings: [] });
      assert.deepEqual(result.warnings, []);
    });
  });

  it("loads accepted findings from .guardian-baseline.json", async () => {
    await withTempDir(async (repoPath) => {
      await writeFile(
        join(repoPath, ".guardian-baseline.json"),
        JSON.stringify({
          acceptedFindings: [
            {
              type: "release",
              title: "GitHub Actions changed"
            }
          ]
        }),
        "utf8"
      );

      const result = await loadBaseline(repoPath);

      assert.deepEqual(result.baseline.acceptedFindings, [
        {
          type: "release",
          title: "GitHub Actions changed"
        }
      ]);
      assert.deepEqual(result.warnings, []);
    });
  });

  it("returns a warning instead of failing when the baseline is invalid", async () => {
    await withTempDir(async (repoPath) => {
      await writeFile(join(repoPath, ".guardian-baseline.json"), "{", "utf8");

      const result = await loadBaseline(repoPath);

      assert.deepEqual(result.baseline, { acceptedFindings: [] });
      assert.deepEqual(result.warnings, [
        ".guardian-baseline.json could not be loaded; accepted findings were ignored."
      ]);
    });
  });
});

describe("applyBaseline", () => {
  it("marks matching findings as accepted and keeps them out of active findings", () => {
    const releaseFinding = makeReleaseFinding({
      title: "GitHub Actions changed"
    });
    const otherFinding = makeReleaseFinding({
      id: "release-package-dependency-changed",
      title: "Package dependency changed"
    });

    const result = applyBaseline([releaseFinding, otherFinding], {
      acceptedFindings: [
        {
          type: "release",
          title: "GitHub Actions changed"
        }
      ]
    });

    assert.deepEqual(result.activeFindings.map((finding) => finding.title), ["Package dependency changed"]);
    assert.deepEqual(result.acceptedFindings.map((finding) => finding.title), ["GitHub Actions changed"]);
    assert.equal(result.acceptedFindings[0].accepted, true);
  });

  it("does not match the same title under a different finding type", () => {
    const finding = makeReleaseFinding({
      title: "Shared title"
    });

    const result = applyBaseline([finding], {
      acceptedFindings: [
        {
          type: "security",
          title: "Shared title"
        }
      ]
    });

    assert.deepEqual(result.activeFindings.map((activeFinding) => activeFinding.title), ["Shared title"]);
    assert.deepEqual(result.acceptedFindings, []);
  });

  it("supports accepting workflow findings by type and title", () => {
    const workflowFinding = makeWorkflowFinding({
      title: "GitHub Actions changed"
    });

    const result = applyBaseline([workflowFinding], {
      acceptedFindings: [
        {
          type: "workflow",
          title: "GitHub Actions changed"
        }
      ]
    });

    assert.deepEqual(result.activeFindings, []);
    assert.deepEqual(result.acceptedFindings.map((finding) => finding.title), ["GitHub Actions changed"]);
    assert.equal(result.acceptedFindings[0].accepted, true);
  });
});

async function withTempDir(test: (repoPath: string) => Promise<void>): Promise<void> {
  const repoPath = await mkdtemp(join(tmpdir(), "guardian-baseline-"));

  try {
    await test(repoPath);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
}

function makeReleaseFinding(overrides: Partial<ReleaseFinding> = {}): GuardianFinding {
  return {
    id: "release-github-actions-changed",
    area: "release",
    title: "GitHub Actions changed",
    description: "A GitHub Actions workflow or local action changed.",
    riskLevel: "high",
    affectedFiles: [".github/workflows/release.yml"],
    whyItMatters: "CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.",
    requiredBeforeDeploy: ["Review workflow triggers, permissions, environments, and secrets usage."],
    ...overrides
  };
}

function makeWorkflowFinding(overrides: Partial<WorkflowFinding> = {}): GuardianFinding {
  return {
    id: "workflow-github-actions-changed",
    area: "workflow",
    title: "GitHub Actions changed",
    description: "A GitHub Actions workflow changed.",
    riskLevel: "high",
    missingCheck: "npm test",
    workflowFile: ".github/workflows/ci.yml",
    recommendation: "Review workflow changes before release.",
    ...overrides
  };
}
