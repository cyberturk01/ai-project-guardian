import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type InitAction = "create" | "overwrite" | "skip";
export type InitPreset = "generic" | "node-api" | "web-app" | "python" | "monorepo";

export type InitArgs = {
  repo?: string;
  preset?: InitPreset;
  force: boolean;
  dryRun: boolean;
  help: boolean;
};

export type InitFileChange = {
  path: string;
  action: InitAction;
};

export type InitResult = {
  exitCode: number;
  changes: InitFileChange[];
  preset?: InitPreset;
};

export type InitOptions = {
  argv: string[];
  cwd?: string;
  stdout?: NodeJS.WritableStream;
};

const projectBrainTemplateFiles = [
  "project.md",
  "architecture.md",
  "testing-strategy.md",
  "deployment-rules.md",
  "security-rules.md",
  "known-risks.md",
  "known-bugs.md",
  "module-map.json"
];

export const initHelpText = `ai-project-guardian init

Usage:
  ai-project-guardian init [--repo <path>] [--preset generic|node-api|web-app|python|monorepo] [--dry-run] [--force]

Options:
  --repo <path>   Target repository path. Defaults to the current working directory.
  --preset <name> Config preset: generic, node-api, web-app, python, or monorepo. Defaults to best-effort detection.
  --dry-run       Print planned file changes without writing files.
  --force         Overwrite existing Guardian bootstrap files.
  --help          Show this help message.
`;

export function parseInitArgs(args: string[]): InitArgs {
  const parsed: InitArgs = {
    force: false,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--repo") {
      parsed.repo = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--preset") {
      parsed.preset = parseInitPreset(readValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    throw new Error(`Unknown init flag: ${arg}`);
  }

  return parsed;
}

export async function runInitCommand(options: InitOptions): Promise<InitResult> {
  const stdout = options.stdout ?? process.stdout;
  const cwd = options.cwd ?? process.cwd();
  const args = parseInitArgs(options.argv);

  if (args.help) {
    stdout.write(initHelpText);
    return { exitCode: 0, changes: [] };
  }

  const repoPath = resolve(cwd, args.repo ?? ".");
  const preset = args.preset ?? (await detectInitPreset(repoPath));
  const plannedFiles = await buildInitFiles(repoPath, preset);
  const changes: InitFileChange[] = [];

  for (const plannedFile of plannedFiles) {
    const exists = await fileExists(plannedFile.absolutePath);
    const action: InitAction = exists ? (args.force ? "overwrite" : "skip") : "create";

    changes.push({
      path: normalizeRelativePath(relative(repoPath, plannedFile.absolutePath)),
      action
    });

    if (args.dryRun || action === "skip") {
      continue;
    }

    await mkdir(dirname(plannedFile.absolutePath), { recursive: true });
    await writeFile(plannedFile.absolutePath, plannedFile.contents, "utf8");
  }

  stdout.write(formatInitSummary(repoPath, changes, args.dryRun, preset));

  return { exitCode: 0, changes, preset };
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parseInitPreset(value: string): InitPreset {
  if (isInitPreset(value)) {
    return value;
  }

  throw new Error(`Unsupported --preset value: ${value}. Expected "generic", "node-api", "web-app", "python", or "monorepo".`);
}

function isInitPreset(value: string): value is InitPreset {
  return value === "generic" || value === "node-api" || value === "web-app" || value === "python" || value === "monorepo";
}

type PlannedInitFile = {
  absolutePath: string;
  contents: string;
};

async function buildInitFiles(repoPath: string, preset: InitPreset): Promise<PlannedInitFile[]> {
  const files: PlannedInitFile[] = [
    {
      absolutePath: join(repoPath, "guardian.config.json"),
      contents: buildGuardianConfig(repoPath, preset)
    },
    {
      absolutePath: join(repoPath, ".github", "workflows", "ai-project-guardian.yml"),
      contents: guardianWorkflowTemplate
    }
  ];

  for (const fileName of projectBrainTemplateFiles) {
    files.push({
      absolutePath: join(repoPath, ".project-brain", fileName),
      contents: await readProjectBrainTemplate(fileName)
    });
  }

  return files;
}

function buildGuardianConfig(repoPath: string, preset: InitPreset): string {
  return `${JSON.stringify(
    buildGuardianConfigObject(repoPath, preset),
    null,
    2
  )}\n`;
}

function buildGuardianConfigObject(repoPath: string, preset: InitPreset): Record<string, unknown> {
  const baseConfig = {
    projectName: basename(repoPath),
    testFolders: ["tests"],
    releaseSensitiveFiles: ["package.json", "package-lock.json", ".env.example", ".github/workflows"],
    requiredChecks: ["npm test"],
    coverageThreshold: 80,
    businessAreas: [],
    customRules: []
  };

  if (preset === "node-api") {
    return {
      ...baseConfig,
      riskFolders: ["src/routes", "src/services", "src/controllers", "src/middleware", "src/auth", "src/config"],
      testFolders: ["tests", "__tests__"]
    };
  }

  if (preset === "web-app") {
    return {
      ...baseConfig,
      riskFolders: ["src", "app", "pages", "components"],
      testFolders: ["tests", "__tests__", "cypress", "e2e"]
    };
  }

  if (preset === "python") {
    return {
      ...baseConfig,
      riskFolders: ["src", "app", "api"],
      testFolders: ["tests"],
      releaseSensitiveFiles: ["pyproject.toml", "requirements.txt", "setup.py", "Dockerfile", ".github/workflows"],
      requiredChecks: ["pytest"]
    };
  }

  if (preset === "monorepo") {
    return {
      ...baseConfig,
      riskFolders: ["packages", "apps", "libs", "src"],
      testFolders: ["tests", "__tests__", "packages", "apps", "libs"],
      releaseSensitiveFiles: ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "turbo.json", "nx.json", ".github/workflows"],
      requiredChecks: ["npm test", "npm run lint"]
    };
  }

  return {
    ...baseConfig,
    riskFolders: ["src"]
  };
}

async function detectInitPreset(repoPath: string): Promise<InitPreset> {
  if (await hasAnyPath(repoPath, ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "tox.ini"])) {
    return "python";
  }

  if (await hasAnyPath(repoPath, ["pnpm-workspace.yaml", "turbo.json", "nx.json", "packages", "apps", "libs"])) {
    return "monorepo";
  }

  if (!(await fileExists(join(repoPath, "package.json")))) {
    return "generic";
  }

  if ((await fileExists(join(repoPath, "src", "routes"))) || (await fileExists(join(repoPath, "src", "services")))) {
    return "node-api";
  }

  if ((await fileExists(join(repoPath, "src", "pages"))) || (await fileExists(join(repoPath, "app"))) || (await hasViteConfig(repoPath))) {
    return "web-app";
  }

  return "generic";
}

async function hasAnyPath(repoPath: string, paths: string[]): Promise<boolean> {
  for (const path of paths) {
    if (await fileExists(join(repoPath, path))) {
      return true;
    }
  }

  return false;
}

async function hasViteConfig(repoPath: string): Promise<boolean> {
  try {
    const entries = await readdir(repoPath);
    return entries.some((entry) => entry.startsWith("vite.config."));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

async function readProjectBrainTemplate(fileName: string): Promise<string> {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const template = await readFile(join(packageRoot, "templates", "project-brain", fileName), "utf8");

  return template.endsWith("\n") ? template : `${template}\n`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function formatInitSummary(repoPath: string, changes: InitFileChange[], dryRun: boolean, preset: InitPreset): string {
  const lines = [`Guardian init ${dryRun ? "dry run" : "summary"} for ${repoPath}`];
  lines.push(`Preset: ${preset}`);
  appendActionGroup(lines, "Created", changes, "create");
  appendActionGroup(lines, "Overwritten", changes, "overwrite");
  appendActionGroup(lines, "Skipped existing", changes, "skip");

  if (dryRun) {
    lines.push("No files written.");
  }

  return `${lines.join("\n")}\n`;
}

function appendActionGroup(lines: string[], title: string, changes: InitFileChange[], action: InitAction): void {
  const matchingChanges = changes.filter((change) => change.action === action);

  if (matchingChanges.length === 0) {
    return;
  }

  lines.push(`${title}: ${matchingChanges.length}`);

  for (const change of matchingChanges) {
    lines.push(`  - ${change.path}`);
  }
}

function normalizeRelativePath(path: string): string {
  return path.split("\\").join("/");
}

const guardianWorkflowTemplate = `name: AI Project Guardian

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read

jobs:
  guardian:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Guardian summary
        run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-summary.md --summary-only --fail-on critical

      - name: Add summary to job summary
        if: always()
        run: |
          if [ -f guardian-summary.md ]; then
            cat guardian-summary.md >> "$GITHUB_STEP_SUMMARY"
          fi

      - name: Generate full Guardian report
        if: always()
        run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-report.md --full-report

      - name: Upload Guardian report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: guardian-report.md
`;
