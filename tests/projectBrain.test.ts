import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectBrain } from "../src/project-brain/loadProjectBrain.js";

const fixturesPath = join(process.cwd(), "tests", "fixtures", "project-brain");

describe("loadProjectBrain", () => {
  it("loads all project brain markdown documents and module map when present", () => {
    const result = loadProjectBrain(join(fixturesPath, "complete"));

    assert.equal(result.warnings.length, 0);
    assert.match(result.projectBrain.documents.project?.content ?? "", /AI Restaurants/);
    assert.match(result.projectBrain.documents.architecture?.content ?? "", /service boundaries/);
    assert.match(result.projectBrain.documents.testingStrategy?.content ?? "", /smoke tests/);
    assert.match(result.projectBrain.documents.deploymentRules?.content ?? "", /migrations/);
    assert.match(result.projectBrain.documents.securityRules?.content ?? "", /tenant isolation/);
    assert.match(result.projectBrain.documents.knownRisks?.content ?? "", /payment provider/);
    assert.match(result.projectBrain.documents.knownBugs?.content ?? "", /CSV import/);
    assert.deepEqual(result.projectBrain.moduleMap, {
      modules: [
        {
          name: "orders",
          paths: ["src/orders"],
          owner: "platform"
        }
      ]
    });
    assert.ok(result.warnings.every((warning) => !warning.includes("missing files")));
  });

  it("warns once when the Project Brain directory is missing", () => {
    const result = loadProjectBrain(mkdtempSync(join(tmpdir(), "guardian-missing-brain-")));

    assert.deepEqual(result.projectBrain.documents, {});
    assert.equal(result.projectBrain.moduleMap, undefined);
    assert.deepEqual(result.warnings, [
      "Project Brain context was not found; continuing without repository-specific context."
    ]);
  });

  it("groups missing file warnings without throwing", () => {
    const result = loadProjectBrain(join(fixturesPath, "partial"));

    assert.match(result.projectBrain.documents.project?.content ?? "", /Partial Brain/);
    assert.equal(result.projectBrain.documents.architecture, undefined);
    assert.equal(result.projectBrain.moduleMap, undefined);
    assert.deepEqual(result.warnings, [
      "Project Brain context is incomplete; missing files: architecture.md, testing-strategy.md, deployment-rules.md, security-rules.md, known-risks.md, known-bugs.md, module-map.json."
    ]);
  });

  it("warns about invalid module-map JSON without failing markdown loading", () => {
    const result = loadProjectBrain(join(fixturesPath, "invalid-map"));

    assert.match(result.projectBrain.documents.project?.content ?? "", /Invalid Map/);
    assert.equal(result.projectBrain.moduleMap, undefined);
    assert.equal(result.warnings.length, 2);
    assert.ok(result.warnings.some((warning) => warning.includes("missing files")));
    assert.ok(result.warnings.some((warning) => warning.includes("contains invalid JSON")));
  });
});
