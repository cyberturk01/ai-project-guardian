import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeRelease } from "../src/analyzers/releaseAnalyzer.js";
import type { ChangedFile, GuardianConfig } from "../src/core/types.js";

const config: GuardianConfig = {
  projectName: "AI Restaurants",
  riskFolders: ["src/api", "src/auth", "src/db", "src/payments"],
  testFolders: ["tests", "e2e"],
  releaseSensitiveFiles: ["package.json", "src/db/schema.sql", ".github/workflows"],
  requiredChecks: ["npm run lint", "npm test", "npm run build"]
};

describe("analyzeRelease", () => {
  it("detects deployment and production risk categories", () => {
    const findings = analyzeRelease({
      changedFiles: [
        changedFile("src/db/migrations/018_add_reservation_rewards.sql", "migration"),
        changedFile(".env.example", "config"),
        changedFile("package-lock.json", "config"),
        changedFile(".github/workflows/deploy.yml", "ci")
      ],
      config
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      [
        "release-migration-changed",
        "release-env-config-changed",
        "release-package-dependency-changed",
        "release-github-actions-changed"
      ]
    );

    const migrationFinding = findings.find((finding) => finding.id === "release-migration-changed");
    assert.equal(migrationFinding?.riskLevel, "high");
    assert.deepEqual(migrationFinding?.affectedFiles, ["src/db/migrations/018_add_reservation_rewards.sql"]);
    assert.match(migrationFinding?.whyItMatters ?? "", /irreversible/);
    assert.ok(migrationFinding?.requiredBeforeDeploy.some((action) => /rollback/.test(action)));
  });

  it("detects stage and production environment changes", () => {
    const findings = analyzeRelease({
      changedFiles: [
        changedFile("config/stage.env", "config"),
        changedFile("config/prod.env", "config")
      ],
      config
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      ["release-stage-prod-env-mismatch"]
    );

    assert.deepEqual(findings[0].affectedFiles, ["config/prod.env", "config/stage.env"]);
    assert.match(findings[0].whyItMatters, /config drift/);
  });

  it("returns no findings for unrelated source changes", () => {
    const findings = analyzeRelease({
      changedFiles: [changedFile("src/components/MenuCard.tsx", "source")],
      config
    });

    assert.deepEqual(findings, []);
  });

  it("ignores Project Brain files even when names match release heuristics", () => {
    const findings = analyzeRelease({
      changedFiles: [
        changedFile(".project-brain/package.json", "project-brain"),
        changedFile(".project-brain/production-env.md", "project-brain"),
        changedFile(".project-brain/staging-env.md", "project-brain")
      ],
      config
    });

    assert.deepEqual(findings, []);
  });
});

function changedFile(path: string, category: ChangedFile["category"]): ChangedFile {
  return {
    path,
    status: "modified",
    category,
    riskLevel: category === "project-brain" ? "info" : category === "ci" || category === "config" || category === "migration" ? "high" : "medium"
  };
}
