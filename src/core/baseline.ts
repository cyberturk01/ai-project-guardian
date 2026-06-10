import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GuardianFinding } from "./types.js";

export const baselineFileName = ".guardian-baseline.json";

export type BaselineFinding = {
  type: GuardianFinding["area"];
  title: string;
};

export type GuardianBaseline = {
  acceptedFindings: BaselineFinding[];
};

export type BaselineLoadResult = {
  baseline: GuardianBaseline;
  warnings: string[];
};

export type ApplyBaselineResult = {
  activeFindings: GuardianFinding[];
  acceptedFindings: GuardianFinding[];
};

const emptyBaseline: GuardianBaseline = {
  acceptedFindings: []
};

export async function loadBaseline(repoPath: string): Promise<BaselineLoadResult> {
  try {
    const raw = await readFile(join(repoPath, baselineFileName), "utf8");
    return {
      baseline: parseBaseline(raw),
      warnings: []
    };
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return {
        baseline: emptyBaseline,
        warnings: []
      };
    }

    return {
      baseline: emptyBaseline,
      warnings: [`${baselineFileName} could not be loaded; accepted findings were ignored.`]
    };
  }
}

export function applyBaseline(findings: GuardianFinding[], baseline: GuardianBaseline): ApplyBaselineResult {
  const acceptedKeys = new Set(
    baseline.acceptedFindings.map((finding) => findingKey(finding.type, finding.title))
  );
  const activeFindings: GuardianFinding[] = [];
  const acceptedFindings: GuardianFinding[] = [];

  for (const finding of findings) {
    if (acceptedKeys.has(findingKey(finding.area, finding.title))) {
      acceptedFindings.push({
        ...finding,
        accepted: true
      });
      continue;
    }

    activeFindings.push(finding);
  }

  return {
    activeFindings,
    acceptedFindings
  };
}

function parseBaseline(raw: string): GuardianBaseline {
  const value: unknown = JSON.parse(raw);

  if (!isObject(value) || !Array.isArray(value.acceptedFindings)) {
    throw new Error(`${baselineFileName} must include acceptedFindings.`);
  }

  return {
    acceptedFindings: value.acceptedFindings.filter(isBaselineFinding)
  };
}

function isBaselineFinding(value: unknown): value is BaselineFinding {
  return (
    isObject(value) &&
    (value.type === "qa" || value.type === "release" || value.type === "security") &&
    typeof value.title === "string" &&
    value.title.trim() !== ""
  );
}

function findingKey(type: GuardianFinding["area"], title: string): string {
  return `${type}:${title.trim().toLowerCase()}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): boolean {
  return isObject(error) && error.code === "ENOENT";
}
