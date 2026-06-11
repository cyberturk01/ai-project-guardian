import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessSession } from "../src/auth/session.js";

test("allows admins", () => {
  assert.equal(canAccessSession("admin"), true);
});
