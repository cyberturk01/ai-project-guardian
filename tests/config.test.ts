import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/loadConfig.js";

describe("loadConfig", () => {
  it("loads defaults for the CLI scaffold", () => {
    const config = loadConfig({});

    assert.equal(config.format, "markdown");
    assert.ok(config.repoPath.endsWith("ai-project-guardian"));
  });

  it("rejects unsupported report formats", () => {
    assert.throws(() => loadConfig({ format: "html" }), /Unsupported report format/);
  });
});
