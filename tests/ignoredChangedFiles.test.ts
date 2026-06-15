import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterIgnoredChangedFiles, isIgnoredChangedFile } from "../src/repo/ignoredChangedFiles.js";

describe("ignored changed files", () => {
  it("ignores generated Guardian reports and local package artifacts", () => {
    for (const path of [
      "guardian-report.md",
      "guardian-summary.md",
      "guardian-pr-comment.md",
      "ai-project-guardian-0.1.0.tgz",
      "package.tar.gz",
      "npm-debug.log.1",
      ".DS_Store"
    ]) {
      assert.equal(isIgnoredChangedFile(path), true, path);
    }
  });

  it("ignores common generated root folders", () => {
    for (const path of ["dist/src/index.js", "coverage/lcov.info", ".next/server/app.js", "node_modules/pkg/index.js"]) {
      assert.equal(isIgnoredChangedFile(path), true, path);
    }
  });

  it("filters current and previous paths before downstream processing", () => {
    const changedFiles = filterIgnoredChangedFiles([
      { path: "src/menu.ts" },
      { path: "guardian-report.md" },
      { path: "src/copied.ts", previousPath: "dist/copied.js" }
    ]);

    assert.deepEqual(changedFiles, [{ path: "src/menu.ts" }]);
  });
});
