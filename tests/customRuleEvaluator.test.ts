import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesCustomRuleGlob } from "../src/analyzers/customRuleEvaluator.js";

describe("matchesCustomRuleGlob", () => {
  it("supports repository-style glob patterns", () => {
    assert.equal(matchesCustomRuleGlob("src/email/sendWelcome.ts", "src/email/**"), true);
    assert.equal(matchesCustomRuleGlob("src/email/templates/welcome.ts", "src/email/**"), true);
    assert.equal(matchesCustomRuleGlob("tests/email/sendWelcome.test.ts", "tests/email/*.test.ts"), true);
    assert.equal(matchesCustomRuleGlob("tests/email/nested/sendWelcome.test.ts", "tests/email/*.test.ts"), false);
    assert.equal(matchesCustomRuleGlob("./src/email/sendWelcome.ts", "src/email/**"), true);
  });
});
