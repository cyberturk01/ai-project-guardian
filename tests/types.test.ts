import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRiskLevel, riskLevels } from "../src/core/types.js";

describe("core types", () => {
  it("recognizes supported risk levels", () => {
    for (const riskLevel of riskLevels) {
      assert.equal(isRiskLevel(riskLevel), true);
    }
  });

  it("rejects unsupported risk levels", () => {
    assert.equal(isRiskLevel("severe"), false);
    assert.equal(isRiskLevel(undefined), false);
  });
});
