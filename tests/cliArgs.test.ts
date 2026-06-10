import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { helpText, parseArgs } from "../src/cli/runGuardian.js";

describe("parseArgs", () => {
  it("reports missing values for flags that require a value", () => {
    assert.throws(() => parseArgs(["--repo"]), /Missing value for --repo/);
    assert.throws(() => parseArgs(["--base"]), /Missing value for --base/);
    assert.throws(() => parseArgs(["--out"]), /Missing value for --out/);
    assert.throws(() => parseArgs(["--fail-on"]), /Missing value for --fail-on/);
  });

  it("reports missing values when the next token is another flag", () => {
    assert.throws(() => parseArgs(["--repo", "--base", "origin/main"]), /Missing value for --repo/);
    assert.throws(() => parseArgs(["--base", "--out", "guardian-report.md"]), /Missing value for --base/);
    assert.throws(() => parseArgs(["--out", "--fail-on", "high"]), /Missing value for --out/);
    assert.throws(() => parseArgs(["--fail-on", "--full-report"]), /Missing value for --fail-on/);
  });

  it("reports unknown flags", () => {
    assert.throws(() => parseArgs(["--repo", ".", "--unknown"]), /Unknown flag: --unknown/);
  });

  it("reports unsupported --fail-on values clearly", () => {
    assert.throws(() => parseArgs(["--fail-on", "medium"]), /Expected "high" or "critical"/);
  });

  it("keeps help output aligned with supported flags", () => {
    assert.match(helpText, /--repo <path>/);
    assert.match(helpText, /--base <ref>/);
    assert.match(helpText, /--out <path>/);
    assert.match(helpText, /--summary-only/);
    assert.match(helpText, /--full-report/);
    assert.match(helpText, /--fail-on <risk>/);
    assert.match(helpText, /--help/);
  });
});
