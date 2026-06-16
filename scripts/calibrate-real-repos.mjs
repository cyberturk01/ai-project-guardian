#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";

const repos = [
  { name: "ai-project-guardian", path: "../ai-project-guardian", expectedRisk: "low" },
  { name: "repo-context-center", path: "../repo-context-center", expectedRisk: "low-medium" },
  { name: "wallet-health-ui", path: "../wallet-health-ui", expectedRisk: "medium" }
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const guardianCli = resolve(projectRoot, "dist/src/cli/index.js");
const defaultOutputRoot = resolve(projectRoot, ".calibration");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoConfig = await loadRepoConfig(options.config);
  const configBaseDir = options.config === undefined ? projectRoot : dirname(resolve(options.config));
  const outputRoot = resolveOutputRoot(options.out);

  await ensureGuardianCli();
  await mkdir(outputRoot, { recursive: true });

  const results = [];
  const skippedRepos = [];

  for (const repo of repoConfig) {
    const repoPath = resolveRepoPath(repo.path, configBaseDir);

    if (!(await pathExists(repoPath))) {
      const warning = `Skipping ${repo.name}: path does not exist (${repoPath})`;
      process.stderr.write(`Warning: ${warning}\n`);
      skippedRepos.push({ ...repo, resolvedPath: repoPath, reason: "path does not exist" });
      continue;
    }

    const workingTree = await getWorkingTreeState(repoPath);

    if (options.requireClean === true && workingTree.isDirty) {
      const warning = `Skipping ${repo.name}: working tree is dirty (${workingTree.changedFilesCount} changed/untracked file(s))`;
      process.stderr.write(`Warning: ${warning}\n`);
      skippedRepos.push({
        ...repo,
        resolvedPath: repoPath,
        reason: "working tree is dirty and --require-clean is enabled",
        workingTree
      });
      continue;
    }

    const repoOutputDir = resolve(outputRoot, safePathSegment(repo.name));
    const summaryPath = resolve(repoOutputDir, "guardian-summary.md");
    const fullReportPath = resolve(repoOutputDir, "guardian-full.md");

    await mkdir(repoOutputDir, { recursive: true });

    process.stdout.write(`Calibrating ${repo.name}...\n`);

    await runGuardian(["--repo", repoPath, "--out", summaryPath, "--summary-only"]);
    await runGuardian(["--repo", repoPath, "--out", fullReportPath, "--full-report"]);

    const jsonOutput = await runGuardian(["--repo", repoPath, "--format", "json"], { quietStdout: true });
    const report = JSON.parse(jsonOutput);
    results.push(buildCalibrationResult({ repo, repoPath, report, summaryPath, fullReportPath, workingTree }));
  }

  const reportMarkdown = renderCalibrationReport({ results, skippedRepos });
  const reportPath = resolve(outputRoot, "CALIBRATION_REPORT.md");
  await writeFile(reportPath, reportMarkdown, "utf8");

  process.stdout.write(`Calibration report written to ${reportPath}\n`);
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--config") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("Missing value for --config");
      }

      options.config = value;
      index += 1;
      continue;
    }

    if (arg === "--require-clean") {
      options.requireClean = true;
      continue;
    }

    if (arg === "--out") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("Missing value for --out");
      }

      options.out = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`Usage: node scripts/calibrate-real-repos.mjs [--config <path>] [--require-clean] [--out <path>]

Runs AI Project Guardian against a list of local repositories and writes:
  .calibration/<repo-name>/guardian-summary.md
  .calibration/<repo-name>/guardian-full.md
  .calibration/CALIBRATION_REPORT.md

Options:
  --config <path>    JSON config file containing an array of repos. Module configs may export a default array or named repos array.
  --require-clean    Skip repositories with uncommitted or untracked files.
  --out <path>       Output directory for calibration artifacts. Defaults to .calibration.
`);
      process.exit(0);
    }

    throw new Error(`Unknown flag: ${arg}`);
  }

  return options;
}

async function loadRepoConfig(configPath) {
  if (configPath === undefined) {
    return repos;
  }

  const resolvedConfigPath = resolve(configPath);

  if (extname(resolvedConfigPath).toLowerCase() === ".json") {
    const loadedRepos = JSON.parse(await readFile(resolvedConfigPath, "utf8"));

    if (!Array.isArray(loadedRepos)) {
      throw new Error(`Calibration JSON config must contain a repo array: ${configPath}`);
    }

    return loadedRepos;
  }

  const configUrl = pathToFileURL(resolvedConfigPath).href;
  const module = await import(configUrl);
  const loadedRepos = module.default ?? module.repos;

  if (!Array.isArray(loadedRepos)) {
    throw new Error(`Calibration config must export a repo array: ${configPath}`);
  }

  return loadedRepos;
}

function resolveOutputRoot(outPath) {
  if (outPath === undefined) {
    return defaultOutputRoot;
  }

  return isAbsolute(outPath) ? outPath : resolve(projectRoot, outPath);
}

async function ensureGuardianCli() {
  if (await pathExists(guardianCli)) {
    return;
  }

  throw new Error(`Guardian CLI was not found at ${guardianCli}. Run npm run build before calibration.`);
}

function resolveRepoPath(repoPath, baseDir) {
  return isAbsolute(repoPath) ? repoPath : resolve(baseDir, repoPath);
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getWorkingTreeState(repoPath) {
  try {
    const stdout = await execCommand("git", ["status", "--short"], { cwd: repoPath, quietStdout: true });
    const entries = parseGitStatus(stdout);

    return {
      state: entries.length === 0 ? "clean" : "dirty",
      isDirty: entries.length > 0,
      changedFilesCount: entries.length,
      firstChangedPaths: entries.slice(0, 10).map((entry) => entry.path),
      warning: entries.length === 0
        ? undefined
        : "Warning: this repository has uncommitted or untracked changes. Calibration results may be inflated."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      state: "unknown",
      isDirty: false,
      changedFilesCount: 0,
      firstChangedPaths: [],
      warning: `Warning: git status could not be read. Calibration may not reflect working tree state. ${message}`
    };
  }
}

function parseGitStatus(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => {
      const pathText = line.length > 3 ? line.slice(3) : line;
      const renameParts = pathText.split(" -> ");

      return {
        status: line.slice(0, 2).trim(),
        path: renameParts[renameParts.length - 1]
      };
    });
}

function runGuardian(args, options = {}) {
  return execCommand(process.execPath, [guardianCli, ...args], { cwd: projectRoot, ...options });
}

function execCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd: options.cwd }, (error, stdout, stderr) => {
      if (stdout.length > 0 && options.quietStdout !== true) {
        process.stdout.write(stdout);
      }

      if (stderr.length > 0) {
        process.stderr.write(stderr);
      }

      if (error !== null) {
        reject(error);
        return;
      }

      resolvePromise(stdout);
    });
  });
}

function buildCalibrationResult({ repo, repoPath, report, summaryPath, fullReportPath, workingTree }) {
  return {
    name: repo.name,
    expectedRisk: repo.expectedRisk ?? "unspecified",
    repoPath,
    workingTree,
    actualRiskScore: report.riskScore,
    overallRisk: report.overallRisk,
    mergeRecommendation: report.mergeRecommendation,
    changedFilesCount: report.changedFiles?.length ?? 0,
    qaFindingsCount: report.qaFindings?.length ?? 0,
    releaseFindingsCount: report.releaseFindings?.length ?? 0,
    securityFindingsCount: report.securityFindings?.length ?? 0,
    workflowFindingsCount: report.workflowFindings?.length ?? 0,
    actionableGuidanceCount: report.actionableGuidance?.length ?? 0,
    riskReason: report.riskReason ?? "",
    summaryPath: relativeFromProject(summaryPath),
    fullReportPath: relativeFromProject(fullReportPath)
  };
}

function renderCalibrationReport({ results, skippedRepos }) {
  const generatedAt = new Date().toISOString();
  const tableRows =
    results.length === 0
      ? "| _No repositories calibrated._ |  |  |  |  |  |  |  |  |  |  |\n"
      : results.map(renderResultRow).join("\n");

  return `# Guardian Real-Repo Calibration Report

Generated: ${generatedAt}

## Comparison

| Repo | Expected risk | Actual risk score | Overall risk | Merge recommendation | Changed files | QA findings | Release findings | Security findings | Workflow findings | Actionable guidance |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${tableRows}

## Report Outputs

${renderOutputLinks(results)}

## Working Tree State

${renderWorkingTreeState({ results, skippedRepos })}

## Dirty Repository Warnings

${renderDirtyWarnings({ results, skippedRepos })}

## Skipped Repositories

${renderSkippedRepos(skippedRepos)}

## Notes For Manual Review

${renderManualReviewNotes(results)}

## Parsing Limitations

- Calibration metrics are read from Guardian JSON output generated during the same run.
- Expected risk is a human-provided calibration label and is not mapped to Guardian's scoring bands.
- Repository state is whatever is present locally at run time, including staged, unstaged, and untracked changes that Guardian detects.
`;
}

function renderResultRow(result) {
  return [
    result.name,
    result.expectedRisk,
    String(result.actualRiskScore),
    result.overallRisk,
    result.mergeRecommendation,
    String(result.changedFilesCount),
    String(result.qaFindingsCount),
    String(result.releaseFindingsCount),
    String(result.securityFindingsCount),
    String(result.workflowFindingsCount),
    String(result.actionableGuidanceCount)
  ]
    .map(escapeTableCell)
    .join(" | ")
    .replace(/^/, "| ")
    .replace(/$/, " |");
}

function renderOutputLinks(results) {
  if (results.length === 0) {
    return "No report outputs were generated.";
  }

  return results
    .map((result) => `- ${result.name}: ${result.summaryPath}, ${result.fullReportPath}`)
    .join("\n");
}

function renderSkippedRepos(skippedRepos) {
  if (skippedRepos.length === 0) {
    return "None.";
  }

  return skippedRepos
    .map((repo) => {
      const workingTreeText =
        repo.workingTree === undefined
          ? ""
          : ` Working tree: ${repo.workingTree.state}, ${repo.workingTree.changedFilesCount} changed/untracked file(s).`;

      return `- ${repo.name}: ${repo.reason} (${repo.resolvedPath}).${workingTreeText}`;
    })
    .join("\n");
}

function renderWorkingTreeState({ results, skippedRepos }) {
  const reposWithState = [
    ...results.map((result) => ({
      name: result.name,
      state: result.workingTree.state,
      changedFilesCount: result.workingTree.changedFilesCount,
      firstChangedPaths: result.workingTree.firstChangedPaths
    })),
    ...skippedRepos
      .filter((repo) => repo.workingTree !== undefined)
      .map((repo) => ({
        name: repo.name,
        state: repo.workingTree.state,
        changedFilesCount: repo.workingTree.changedFilesCount,
        firstChangedPaths: repo.workingTree.firstChangedPaths
      }))
  ];

  if (reposWithState.length === 0) {
    return "No working tree state was captured.";
  }

  const tableRows = reposWithState
    .map((repo) =>
      [
        repo.name,
        repo.state,
        String(repo.changedFilesCount),
        repo.firstChangedPaths.length === 0 ? "None" : repo.firstChangedPaths.join("<br>")
      ]
        .map(escapeTableCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |")
    )
    .join("\n");

  return `| Repo | State | Changed/untracked files | First 10 changed paths |
| --- | --- | ---: | --- |
${tableRows}`;
}

function renderDirtyWarnings({ results, skippedRepos }) {
  const dirtyRepos = [
    ...results.map((result) => ({
      name: result.name,
      workingTree: result.workingTree
    })),
    ...skippedRepos
      .filter((repo) => repo.workingTree !== undefined)
      .map((repo) => ({
        name: repo.name,
        workingTree: repo.workingTree
      }))
  ].filter((repo) => repo.workingTree.warning !== undefined);

  if (dirtyRepos.length === 0) {
    return "None.";
  }

  return dirtyRepos
    .map((repo) => `- ${repo.name}: ${repo.workingTree.warning}`)
    .join("\n");
}

function renderManualReviewNotes(results) {
  if (results.length === 0) {
    return "- [ ] No calibrated repositories. Add local repo paths and rerun.";
  }

  return results
    .map((result) => {
      const riskReason = result.riskReason.length > 0 ? ` Risk reason: ${result.riskReason}` : "";
      return `- [ ] ${result.name}: compare expected ${result.expectedRisk} with actual ${result.overallRisk} (${result.actualRiskScore}/100).${riskReason}`;
    })
    .join("\n");
}

function relativeFromProject(path) {
  return path.replace(`${projectRoot}/`, "");
}

function safePathSegment(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "repo";
}

function escapeTableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Calibration failed: ${message}\n`);
  process.exitCode = 1;
});
