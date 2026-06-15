import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("built CLI bin", () => {
  it("runs from dist with --help", async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(testDir, "../src/cli/index.js");

    const { stdout, stderr } = await execFileAsync(cliPath, ["--help"]);

    assert.equal(stderr, "");
    assert.match(stdout, /^ai-project-guardian/);
    assert.match(stdout, /--repo <path>/);
    assert.match(stdout, /--help/);
  });
});
