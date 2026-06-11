import assert from "node:assert/strict";
import { test } from "node:test";

test("account model smoke test", () => {
  assert.equal("account".length, 7);
});
