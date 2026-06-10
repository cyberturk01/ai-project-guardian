import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const allowedKeys = new Set<keyof GuardianConfig>([
  "projectName",
  "riskFolders",
  "testFolders",
  "releaseSensitiveFiles",
  "requiredChecks"
]);

export function loadGuardianConfig(repoPath: string): GuardianConfigLoadResult {
  const configPath = join(repoPath, guardianConfigFileName);

  try {
    const rawConfig = readFileSync(configPath, "utf8");
    return validateGuardianConfig(JSON.parse(rawConfig));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        config: { ...defaultGuardianConfig },
        warnings: [`${guardianConfigFileName} was not found; using default Guardian config.`]
      };
    }

    return {
      config: { ...defaultGuardianConfig },
      warnings: [`${guardianConfigFileName} could not be loaded; using default Guardian config.`]
    };
  }
}

export function validateGuardianConfig(value: unknown): GuardianConfigLoadResult {
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

  assignStringArray(config, value, "riskFolders", warnings);
  assignStringArray(config, value, "testFolders", warnings);
  assignStringArray(config, value, "releaseSensitiveFiles", warnings);
  assignStringArray(config, value, "requiredChecks", warnings);

  return { config, warnings };
}

function assignStringArray(
  config: GuardianConfig,
  value: Record<string, unknown>,
  field: keyof Omit<GuardianConfig, "projectName">,
  warnings: string[]
): void {
  const fieldValue = value[field];

  if (fieldValue === undefined) {
    return;
  }

  if (Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === "string")) {
    config[field] = fieldValue;
    return;
  }

  warnings.push(`Guardian config field "${field}" must be an array of strings; using default value.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
