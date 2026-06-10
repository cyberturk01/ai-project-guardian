import type { ChangedFile, GuardianConfig, ReleaseFinding, RiskLevel } from "../core/types.js";

export type AnalyzeReleaseInput = {
  changedFiles: ChangedFile[];
  config: GuardianConfig;
};

type ReleaseRule = {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  whyItMatters: string;
  requiredBeforeDeploy: string[];
  matches: (file: ChangedFile, context: ReleaseContext) => boolean;
};

type ReleaseContext = {
  changedPaths: string[];
};

const migrationPathPattern = /(^|\/)(migrations?|schema|prisma\/migrations|db\/schema|database\/schema)(\/|\.|$)/i;
const envExamplePattern = /(^|\/)(\.env(\.[^.\/]+)?(\.example)?|env\.example|example\.env|config\/.*env.*|configs?\/.*env.*|settings\/.*env.*)(\.|\/|$)/i;
const stageEnvPattern = /(^|\/|\.|-|_)(stage|staging)(\.|-|_|\/|$)/i;
const prodEnvPattern = /(^|\/|\.|-|_)(prod|production)(\.|-|_|\/|$)/i;
const packageDependencyPattern = /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|bun\.lock|composer\.json|composer\.lock|requirements\.txt|poetry\.lock|pyproject\.toml|go\.mod|go\.sum|cargo\.toml|cargo\.lock|gemfile|gemfile\.lock)$/i;
const githubActionsPattern = /(^|\/)\.github\/(workflows|actions)(\/|$)/i;
const projectBrainPathPattern = /(^|\/)\.project-brain(\/|$)/i;

const releaseRules: ReleaseRule[] = [
  {
    id: "release-migration-changed",
    title: "Database migration changed",
    description: "A database migration or schema file changed.",
    riskLevel: "high",
    whyItMatters: "Database changes can be irreversible, can fail during deploy, or can require coordinated application rollout steps.",
    requiredBeforeDeploy: [
      "Run migration checks against a production-like database.",
      "Confirm rollback or forward-fix instructions are documented.",
      "Verify the application is compatible before and after the migration."
    ],
    matches: (file) => file.category === "migration" || migrationPathPattern.test(normalizePath(file.path))
  },
  {
    id: "release-stage-prod-env-mismatch",
    title: "Stage/prod environment config changed",
    description: "Stage and production environment-related files changed together.",
    riskLevel: "high",
    whyItMatters: "Stage/prod config drift can make a release pass staging while failing or behaving differently in production.",
    requiredBeforeDeploy: [
      "Diff stage and production settings for intentional differences only.",
      "Confirm required secrets and environment variables exist in the production deploy target.",
      "Run a deployment dry run or config validation check."
    ],
    matches: (file, context) => isEnvConfigPath(file.path) && hasStageAndProdEnvChanges(context.changedPaths)
  },
  {
    id: "release-env-config-changed",
    title: "Environment or example config changed",
    description: "Environment, settings, or example configuration changed.",
    riskLevel: "medium",
    whyItMatters: "Config changes can introduce missing variables, stale examples, or deployment settings that are not present in CI or production.",
    requiredBeforeDeploy: [
      "Update deployment secrets or environment variables as needed.",
      "Confirm .env.example matches the documented runtime requirements.",
      "Validate the app starts with production-like configuration."
    ],
    matches: (file, context) => isEnvConfigPath(file.path) && !hasStageAndProdEnvChanges(context.changedPaths)
  },
  {
    id: "release-package-dependency-changed",
    title: "Package dependency changed",
    description: "A package manifest or lockfile changed.",
    riskLevel: "high",
    whyItMatters: "Dependency updates can alter runtime behavior, build output, transitive packages, and known vulnerability exposure.",
    requiredBeforeDeploy: [
      "Run install, build, and test checks from a clean dependency install.",
      "Review dependency diff for major upgrades or new runtime packages.",
      "Run dependency audit or equivalent security scanning."
    ],
    matches: (file) => packageDependencyPattern.test(normalizePath(file.path))
  },
  {
    id: "release-github-actions-changed",
    title: "GitHub Actions changed",
    description: "A GitHub Actions workflow or local action changed.",
    riskLevel: "high",
    whyItMatters: "CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.",
    requiredBeforeDeploy: [
      "Review workflow triggers, permissions, environments, and secrets usage.",
      "Confirm required checks still run before deployment.",
      "Validate the workflow on a non-production branch or dry run."
    ],
    matches: (file) => file.category === "ci" || githubActionsPattern.test(normalizePath(file.path))
  }
];

export function analyzeRelease(input: AnalyzeReleaseInput): ReleaseFinding[] {
  const releaseChangedFiles = input.changedFiles.filter((file) => !isProjectBrainFile(file));
  const context: ReleaseContext = {
    changedPaths: releaseChangedFiles.map((file) => normalizePath(file.path))
  };

  return releaseRules
    .map((rule) => buildFinding(rule, releaseChangedFiles, context))
    .filter((finding): finding is ReleaseFinding => finding !== undefined);
}

function buildFinding(rule: ReleaseRule, changedFiles: ChangedFile[], context: ReleaseContext): ReleaseFinding | undefined {
  const affectedFiles = uniqueSorted(
    changedFiles
      .filter((file) => rule.matches(file, context))
      .map((file) => normalizePath(file.path))
  );

  if (affectedFiles.length === 0) {
    return undefined;
  }

  return {
    id: rule.id,
    area: "release",
    title: rule.title,
    description: rule.description,
    riskLevel: rule.riskLevel,
    affectedFiles,
    whyItMatters: rule.whyItMatters,
    requiredBeforeDeploy: rule.requiredBeforeDeploy
  };
}

function isEnvConfigPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return envExamplePattern.test(normalizedPath);
}

function hasStageAndProdEnvChanges(paths: string[]): boolean {
  const envPaths = paths.filter(isEnvConfigPath);
  return envPaths.some((path) => stageEnvPattern.test(path)) && envPaths.some((path) => prodEnvPattern.test(path));
}

function isProjectBrainFile(file: ChangedFile): boolean {
  return file.category === "project-brain" || projectBrainPathPattern.test(normalizePath(file.path));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
