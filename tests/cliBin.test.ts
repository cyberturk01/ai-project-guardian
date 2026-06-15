import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("package CLI smoke", () => {
  it("runs the built dist bin with --help", async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(testDir, "../src/cli/index.js");

    const { stdout, stderr } = await execFileAsync(cliPath, ["--help"]);

    assert.equal(stderr, "");
    assert.match(stdout, /^ai-project-guardian/);
    assert.match(stdout, /--repo <path>/);
    assert.match(stdout, /--help/);
  });

  it("runs the packed tarball with help and init dry-run commands", async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = resolve(testDir, "../..");
    const packDir = await mkdtemp(resolve(tmpdir(), "guardian-pack-"));
    const cacheDir = await mkdtemp(resolve(tmpdir(), "guardian-npm-cache-"));
    const repoPath = await mkdtemp(resolve(tmpdir(), "guardian-package-smoke-"));

    try {
      const { stdout: packStdout } = await execFileAsync("npm", ["pack", "--pack-destination", packDir, "--json"], {
        cwd: packageRoot,
        env: { ...process.env, npm_config_cache: cacheDir }
      });
      const packResult = JSON.parse(packStdout) as Array<{ filename: string }>;
      const tarballPath = resolve(packDir, packResult[0].filename);

      const help = await runPackedCli(tarballPath, ["--help"], repoPath, cacheDir);
      assert.match(help.stdout, /^ai-project-guardian/);
      assert.match(help.stdout, /init \[--repo <path>\]/);

      const dryRun = await runPackedCli(tarballPath, ["init", "--dry-run"], repoPath, cacheDir);
      assert.match(dryRun.stdout, /Guardian init dry run/);
      assert.match(dryRun.stdout, /Preset: generic/);
      assert.match(dryRun.stdout, /No files written\./);
      await assert.rejects(access(resolve(repoPath, "guardian.config.json")));

      const nodeApiDryRun = await runPackedCli(tarballPath, ["init", "--preset", "node-api", "--dry-run"], repoPath, cacheDir);
      assert.match(nodeApiDryRun.stdout, /Guardian init dry run/);
      assert.match(nodeApiDryRun.stdout, /Preset: node-api/);
      assert.match(nodeApiDryRun.stdout, /No files written\./);

      const pythonDryRun = await runPackedCli(tarballPath, ["init", "--preset", "python", "--dry-run"], repoPath, cacheDir);
      assert.match(pythonDryRun.stdout, /Guardian init dry run/);
      assert.match(pythonDryRun.stdout, /Preset: python/);

      const monorepoDryRun = await runPackedCli(tarballPath, ["init", "--preset", "monorepo", "--dry-run"], repoPath, cacheDir);
      assert.match(monorepoDryRun.stdout, /Guardian init dry run/);
      assert.match(monorepoDryRun.stdout, /Preset: monorepo/);
      await assert.rejects(access(resolve(repoPath, ".github", "workflows", "ai-project-guardian.yml")));
    } finally {
      await rm(packDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

async function runPackedCli(
  tarballPath: string,
  args: string[],
  cwd: string,
  cacheDir: string
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("npm", ["exec", "--yes", "--package", tarballPath, "--", "ai-project-guardian", ...args], {
    cwd,
    env: { ...process.env, npm_config_cache: cacheDir }
  });
}
