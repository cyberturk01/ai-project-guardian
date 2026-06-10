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
        requiredChecks: ["npm test"]
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
        requiredChecks: ["npm test"]
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
        requiredChecks: ["npm test"]
      }),
      "utf8"
    );

    const result = loadGuardianConfig(repoPath);

    assert.deepEqual(result.config.riskFolders, ["src/api", "src/auth"]);
    assert.deepEqual(result.config.testFolders, ["tests"]);
    assert.deepEqual(result.config.releaseSensitiveFiles, ["../shared/package.json"]);
    assert.deepEqual(result.config.requiredChecks, ["npm test"]);
  });

  it("uses defaults and warns when config is missing", () => {
    const result = loadGuardianConfig(makeRepo());

    assert.equal(result.config.projectName, "ai-project-guardian");
    assert.deepEqual(result.config.riskFolders, []);
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
    assert.equal(result.warnings.length, 4);
  });
});

function makeRepo(): string {
  return mkdtempSync(join(tmpdir(), "guardian-config-test-"));
}
