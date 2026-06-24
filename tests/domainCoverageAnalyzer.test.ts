import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDomainCoverageSuggestions,
  detectReviewDomains
} from "../src/analyzers/domainCoverageAnalyzer.js";
import type { ChangedFile } from "../src/core/types.js";

describe("domain coverage suggestions", () => {
  it("suggests auth review coverage for auth paths", () => {
    const suggestions = buildDomainCoverageSuggestions([changedFile("src/auth/sessionToken.ts")]);

    assert.deepEqual(detectReviewDomains([changedFile("src/auth/sessionToken.ts")]), ["auth"]);
    assert.deepEqual(suggestions, [
      "auth: happy path",
      "auth: invalid credentials",
      "auth: expired token",
      "auth: unauthorized access",
      "auth: permission denied"
    ]);
  });

  it("suggests api review coverage for API paths", () => {
    const suggestions = buildDomainCoverageSuggestions([changedFile("src/api/reservations.ts")]);

    assert.deepEqual(detectReviewDomains([changedFile("src/api/reservations.ts")]), ["api"]);
    assert.deepEqual(suggestions, ["api: success response", "api: bad request", "api: unauthorized", "api: not found"]);
  });

  it("suggests cli review coverage for CLI paths", () => {
    const suggestions = buildDomainCoverageSuggestions([changedFile("src/cli/runGuardian.ts")]);

    assert.deepEqual(detectReviewDomains([changedFile("src/cli/runGuardian.ts")]), ["cli"]);
    assert.deepEqual(suggestions, ["cli: valid command", "cli: invalid input", "cli: output contract", "cli: regression"]);
  });

  it("suggests workflow review coverage for workflow paths", () => {
    const suggestions = buildDomainCoverageSuggestions([changedFile(".github/workflows/release.yml")]);

    assert.deepEqual(detectReviewDomains([changedFile(".github/workflows/release.yml")]), ["workflow"]);
    assert.deepEqual(suggestions, [
      "workflow: trigger behavior",
      "workflow: permissions",
      "workflow: artifact generation",
      "workflow: required checks"
    ]);
  });

  it("suggests config review coverage for config paths", () => {
    const suggestions = buildDomainCoverageSuggestions([changedFile("guardian.config.json", "config")]);

    assert.deepEqual(detectReviewDomains([changedFile("guardian.config.json", "config")]), ["config"]);
    assert.deepEqual(suggestions, ["config: clean install", "config: build", "config: test", "config: audit"]);
  });

  it("does not suggest review coverage for unknown paths", () => {
    const files = [changedFile("src/lib/dateFormatter.ts")];

    assert.deepEqual(detectReviewDomains(files), []);
    assert.deepEqual(buildDomainCoverageSuggestions(files), []);
  });
});

function changedFile(path: string, category: ChangedFile["category"] = "source"): ChangedFile {
  return {
    path,
    status: "modified",
    category,
    riskLevel: "medium"
  };
}
