import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterIgnoredChangedFiles, isIgnoredChangedFile } from "../src/repo/ignoredChangedFiles.js";

describe("ignored changed files", () => {
  it("ignores generated Guardian reports and local package artifacts", () => {
    for (const path of [
      "guardian-report.md",
      "guardian-summary.md",
      "guardian-pr-comment.md",
      "reports/guardian-full.md",
      "ai-project-guardian-0.1.0.tgz",
      "package.tar.gz",
      "npm-debug.log.1",
      ".DS_Store"
    ]) {
      assert.equal(isIgnoredChangedFile(path), true, path);
    }
  });

  it("ignores common generated root folders", () => {
    for (const path of [
      ".calibration/CALIBRATION_REPORT.md",
      ".cache/babel.json",
      ".mypy_cache/module.json",
      ".nyc_output/out.json",
      ".parcel-cache/data",
      ".pytest_cache/v/cache/nodeids",
      ".ruff_cache/content",
      ".turbo/runs/build.json",
      ".vite/deps/react.js",
      "__pycache__/app.cpython-312.pyc",
      "build/index.js",
      "dist/src/index.js",
      "htmlcov/index.html",
      "out/page.html",
      "coverage/lcov.info",
      ".next/server/app.js",
      "node_modules/pkg/index.js"
    ]) {
      assert.equal(isIgnoredChangedFile(path), true, path);
    }
  });

  it("does not ignore real source, config, or package changes", () => {
    for (const path of [
      "package.json",
      "package-lock.json",
      "pyproject.toml",
      "requirements.txt",
      "src/cache/client.ts",
      "src/buildPlan.ts",
      "apps/web/package.json",
      "packages/api/src/index.ts"
    ]) {
      assert.equal(isIgnoredChangedFile(path), false, path);
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
