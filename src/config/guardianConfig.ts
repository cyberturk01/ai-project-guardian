import { readFileSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";
import type { GuardianConfig } from "../core/types.js";

export const guardianConfigFileName = "guardian.config.json";

export const defaultGuardianConfig: GuardianConfig = {
  projectName: "ai-project-guardian",
  riskFolders: [],
  testFolders: [],
  releaseSensitiveFiles: [],
  requiredChecks: []
};

export type GuardianConfigLoadResult = {
  config: GuardianConfig;
  warnings: string[];
};

type GuardianConfigArrayField = keyof Omit<GuardianConfig, "projectName">;

const allowedKeys = new Set<keyof GuardianConfig>([
  "projectName",
  "riskFolders",
  "testFolders",
  "releaseSensitiveFiles",
  "requiredChecks"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
