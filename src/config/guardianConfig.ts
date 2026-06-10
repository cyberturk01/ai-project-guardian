import { readFileSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";
import type { BusinessArea, GuardianConfig } from "../core/types.js";
import { isRiskLevel } from "../core/types.js";

export const guardianConfigFileName = "guardian.config.json";

export const defaultGuardianConfig: GuardianConfig = {
  projectName: "ai-project-guardian",
  riskFolders: [],
  testFolders: [],
  releaseSensitiveFiles: [],
  requiredChecks: [],
  businessAreas: []
};

export type GuardianConfigLoadResult = {
  config: GuardianConfig;
  warnings: string[];
};

type GuardianConfigArrayField = "riskFolders" | "testFolders" | "releaseSensitiveFiles" | "requiredChecks";

const allowedKeys = new Set<keyof GuardianConfig>([
  "projectName",
  "riskFolders",
  "testFolders",
  "releaseSensitiveFiles",
  "requiredChecks",
  "businessAreas"
]);

export function loadGuardianConfig(repoPath: string): GuardianConfigLoadResult {
  const resolvedRepoPath = resolve(repoPath);
  const configPath = join(resolvedRepoPath, guardianConfigFileName);

  try {
    const rawConfig = readFileSync(configPath, "utf8");
    return validateGuardianConfig(JSON.parse(rawConfig), resolvedRepoPath);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        config: { ...defaultGuardianConfig },
        warnings: [`${guardianConfigFileName} was not found at ${configPath}; using default Guardian config.`]
      };
    }

    return {
      config: { ...defaultGuardianConfig },
      warnings: [`${guardianConfigFileName} could not be loaded; using default Guardian config.`]
    };
  }
}

export function validateGuardianConfig(value: unknown, repoPath?: string): GuardianConfigLoadResult {
  const warnings: string[] = [];
  const config: GuardianConfig = { ...defaultGuardianConfig };

  if (!isRecord(value)) {
    return {
      config,
      warnings: ["Guardian config must be a JSON object; using default Guardian config."]
    };
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key as keyof GuardianConfig)) {
      warnings.push(`Unknown Guardian config field "${key}" was ignored.`);
    }
  }

  if (value.projectName !== undefined) {
    if (typeof value.projectName === "string" && value.projectName.trim() !== "") {
      config.projectName = value.projectName;
    } else {
      warnings.push('Guardian config field "projectName" must be a non-empty string; using default value.');
    }
  }

  assignStringArray(config, value, "riskFolders", warnings, repoPath);
  assignStringArray(config, value, "testFolders", warnings, repoPath);
  assignStringArray(config, value, "releaseSensitiveFiles", warnings, repoPath);
  assignStringArray(config, value, "requiredChecks", warnings);
  assignBusinessAreas(config, value, warnings, repoPath);

  return { config, warnings };
}

function assignStringArray(
  config: GuardianConfig,
  value: Record<string, unknown>,
  field: GuardianConfigArrayField,
  warnings: string[],
  repoPath?: string
): void {
  const fieldValue = value[field];

  if (fieldValue === undefined) {
    return;
  }

  if (Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === "string")) {
    config[field] = repoPath === undefined ? fieldValue : fieldValue.map((item) => normalizeRepoPath(repoPath, item));
    return;
  }

  warnings.push(`Guardian config field "${field}" must be an array of strings; using default value.`);
}

function normalizeRepoPath(repoPath: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return relative(repoPath, resolve(repoPath, path));
}

function assignBusinessAreas(
  config: GuardianConfig,
  value: Record<string, unknown>,
  warnings: string[],
  repoPath?: string
): void {
  const fieldValue = value.businessAreas;

  if (fieldValue === undefined) {
    return;
  }

  if (!Array.isArray(fieldValue)) {
    warnings.push('Guardian config field "businessAreas" must be an array; using default value.');
    return;
  }

  const businessAreas: BusinessArea[] = [];

  fieldValue.forEach((item, index) => {
    const businessArea = validateBusinessArea(item, index, warnings, repoPath);

    if (businessArea !== undefined) {
      businessAreas.push(businessArea);
    }
  });

  config.businessAreas = businessAreas;
}

function validateBusinessArea(
  value: unknown,
  index: number,
  warnings: string[],
  repoPath?: string
): BusinessArea | undefined {
  const prefix = `Guardian config businessAreas[${index}]`;

  if (!isRecord(value)) {
    warnings.push(`${prefix} must be an object; entry was ignored.`);
    return undefined;
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    warnings.push(`${prefix}.name must be a non-empty string; entry was ignored.`);
    return undefined;
  }

  if (!isRiskLevel(value.riskLevel)) {
    warnings.push(`${prefix}.riskLevel must be one of info, low, medium, high, critical; entry was ignored.`);
    return undefined;
  }

  if (!isStringArray(value.paths) || value.paths.length === 0) {
    warnings.push(`${prefix}.paths must be a non-empty array of strings; entry was ignored.`);
    return undefined;
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    warnings.push(`${prefix}.description must be a string when provided; entry was ignored.`);
    return undefined;
  }

  if (value.requiredTestHints !== undefined && !isStringArray(value.requiredTestHints)) {
    warnings.push(`${prefix}.requiredTestHints must be an array of strings when provided; entry was ignored.`);
    return undefined;
  }

  if (value.requiredBeforeDeploy !== undefined && !isStringArray(value.requiredBeforeDeploy)) {
    warnings.push(`${prefix}.requiredBeforeDeploy must be an array of strings when provided; entry was ignored.`);
    return undefined;
  }

  return {
    name: value.name,
    description: value.description,
    riskLevel: value.riskLevel,
    paths: repoPath === undefined ? value.paths : value.paths.map((path) => normalizeRepoPath(repoPath, path)),
    requiredTestHints: value.requiredTestHints,
    requiredBeforeDeploy: value.requiredBeforeDeploy
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
