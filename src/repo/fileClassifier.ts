import { basename, extname } from "node:path";
import type { ChangedFileCategory, GuardianConfig, RiskLevel } from "../core/types.js";

export type ClassifiedFile = {
  path: string;
  category: ChangedFileCategory;
  riskLevel: RiskLevel;
};

const sourceExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".vue"
]);

const documentationExtensions = new Set([".adoc", ".md", ".mdx", ".rst", ".txt"]);
const configExtensions = new Set([".config", ".env", ".ini", ".json", ".toml", ".yaml", ".yml"]);
const i18nExtensions = new Set([".json", ".po", ".properties", ".xliff", ".yaml", ".yml"]);
const migrationExtensions = new Set([".js", ".json", ".sql", ".ts"]);

const configNames = new Set([
  ".env",
  ".env.example",
  ".eslintrc",
  ".gitignore",
  ".npmrc",
  ".prettierrc",
  "dockerfile",
  "guardian.config.json",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "yarn.lock"
]);

const securityPathPattern = /(^|\/)(auth|authentication|authorization|crypto|jwt|oauth|password|permissions|secrets?|security)(\/|\.|-|_|$)/i;
const testPathPattern = /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i;
const migrationPathPattern = /(^|\/)(migrations?|schema|prisma\/migrations)(\/|$)/i;
const ciPathPattern = /(^|\/)(\.github\/workflows|\.github\/actions|\.gitlab-ci\.yml|circleci|\.circleci|jenkinsfile|buildkite|\.buildkite)(\/|$)/i;
const documentationPathPattern = /(^|\/)(docs?|documentation|adr|readme)(\/|$)|(^|\/)(readme|changelog|contributing|license)(\.[^.]+)?$/i;
const projectBrainPathPattern = /(^|\/)\.project-brain(\/|$)/i;
const i18nPathPattern = /(^|\/)(i18n|l10n|locales?|translations?|lang|messages)(\/|$)/i;

export function classifyFile(path: string, config: GuardianConfig): ClassifiedFile {
  const normalizedPath = normalizePath(path);
  const category = classifyFileCategory(normalizedPath, config);

  return {
    path,
    category,
    riskLevel: classifyRiskLevel(normalizedPath, category, config)
  };
}

export function classifyFileCategory(path: string, config: GuardianConfig): ChangedFileCategory {
  if (isProjectBrainFile(path)) {
    return "documentation";
  }

  if (matchesConfiguredPath(path, config.releaseSensitiveFiles)) {
    return classifyReleaseSensitiveFile(path);
  }

  if (matchesConfiguredPath(path, config.riskFolders) || isSecurityFile(path)) {
    return "security";
  }

  if (isMigrationFile(path)) {
    return "migration";
  }

  if (isCiFile(path)) {
    return "ci";
  }

  if (isConfigFile(path)) {
    return "config";
  }

  if (matchesConfiguredPath(path, config.testFolders) || isTestFile(path)) {
    return "test";
  }

  if (isDocumentationFile(path)) {
    return "documentation";
  }

  if (isI18nFile(path)) {
    return "i18n";
  }

  if (isSourceFile(path)) {
    return "source";
  }

  return "unknown";
}

export function classifyRiskLevel(path: string, category: ChangedFileCategory, config: GuardianConfig): RiskLevel {
  if (isProjectBrainFile(path)) {
    return "info";
  }

  if (matchesConfiguredPath(path, config.releaseSensitiveFiles) || matchesConfiguredPath(path, config.riskFolders)) {
    return "high";
  }

  if (category === "migration" || category === "security" || category === "config") {
    return "high";
  }

  if (category === "ci") {
    return isHighRiskCiFile(path) ? "high" : "medium";
  }

  if (category === "test") {
    return "low";
  }

  if (category === "documentation") {
    return "info";
  }

  if (category === "source") {
    return "medium";
  }

  if (category === "i18n") {
    return "low";
  }

  return "info";
}

function classifyReleaseSensitiveFile(path: string): ChangedFileCategory {
  if (isSecurityFile(path)) {
    return "security";
  }

  if (isMigrationFile(path)) {
    return "migration";
  }

  if (isCiFile(path)) {
    return "ci";
  }

  if (isConfigFile(path)) {
    return "config";
  }

  return "source";
}

function isSourceFile(path: string): boolean {
  return sourceExtensions.has(extname(path).toLowerCase());
}

function isTestFile(path: string): boolean {
  return testPathPattern.test(path);
}

function isMigrationFile(path: string): boolean {
  return migrationPathPattern.test(path) && migrationExtensions.has(extname(path).toLowerCase());
}

function isConfigFile(path: string): boolean {
  const name = basename(path).toLowerCase();
  const extension = extname(path).toLowerCase();

  return (
    configNames.has(name) ||
    name.startsWith(".env.") ||
    name.endsWith(".config.js") ||
    name.endsWith(".config.ts") ||
    name.endsWith(".config.mjs") ||
    name.endsWith(".config.cjs") ||
    configExtensions.has(extension) && /(^|\/)(config|configs?|settings|env)(\/|$)/i.test(path)
  );
}

function isCiFile(path: string): boolean {
  return ciPathPattern.test(path);
}

function isDocumentationFile(path: string): boolean {
  return documentationPathPattern.test(path) || documentationExtensions.has(extname(path).toLowerCase());
}

function isProjectBrainFile(path: string): boolean {
  return projectBrainPathPattern.test(path);
}

function isI18nFile(path: string): boolean {
  return i18nPathPattern.test(path) && i18nExtensions.has(extname(path).toLowerCase());
}

function isSecurityFile(path: string): boolean {
  return securityPathPattern.test(path);
}

function isHighRiskCiFile(path: string): boolean {
  return /(^|\/)(deploy|release|publish|production|prod|infra|terraform|secrets?)(\.|-|_|\/|$)/i.test(path);
}

function matchesConfiguredPath(path: string, configuredPaths: string[]): boolean {
  return configuredPaths.some((configuredPath) => {
    const normalizedConfiguredPath = normalizePath(configuredPath);

    return path === normalizedConfiguredPath || path.startsWith(`${normalizedConfiguredPath}/`);
  });
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
