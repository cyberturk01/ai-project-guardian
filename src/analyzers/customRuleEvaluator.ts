import type { ChangedFile, CustomRule, QaFinding, ReleaseFinding } from "../core/types.js";

export type EvaluateCustomQaRulesInput = {
  changedFiles: ChangedFile[];
  repoFiles: string[];
  customRules?: CustomRule[];
};

export type EvaluateCustomReleaseRulesInput = {
  changedFiles: ChangedFile[];
  customRules?: CustomRule[];
};

export function evaluateCustomQaRules(input: EvaluateCustomQaRulesInput): QaFinding[] {
  return customRulesWithRequiredTests(input.customRules)
    .map((rule) => buildQaFinding(rule, input.changedFiles, input.repoFiles))
    .filter((finding): finding is QaFinding => finding !== undefined);
}

export function evaluateCustomReleaseRules(input: EvaluateCustomReleaseRulesInput): ReleaseFinding[] {
  return customRulesWithReleaseActions(input.customRules)
    .map((rule) => buildReleaseFinding(rule, input.changedFiles))
    .filter((finding): finding is ReleaseFinding => finding !== undefined);
}

export function matchesCustomRuleGlob(path: string, pattern: string): boolean {
  return globToRegExp(normalizePath(pattern)).test(normalizePath(path));
}

function buildQaFinding(rule: CustomRule & { requiresTest: string }, changedFiles: ChangedFile[], repoFiles: string[]): QaFinding | undefined {
  const affectedFiles = matchingActiveChangedFiles(changedFiles, rule.whenChanged);

  if (affectedFiles.length === 0 || repoFiles.some((repoFile) => matchesCustomRuleGlob(repoFile, rule.requiresTest))) {
    return undefined;
  }

  return {
    id: rule.id,
    area: "qa",
    title: rule.title ?? `Custom QA rule failed: ${rule.id}`,
    description: rule.description ?? `Files matching ${rule.whenChanged} changed without tests matching ${rule.requiresTest}.`,
    riskLevel: rule.risk,
    affectedFiles,
    suggestedTests: [`Add or update tests matching ${rule.requiresTest} for files matching ${rule.whenChanged}.`]
  };
}

function buildReleaseFinding(rule: CustomRule & { requiredBeforeDeploy: string[] }, changedFiles: ChangedFile[]): ReleaseFinding | undefined {
  const affectedFiles = matchingActiveChangedFiles(changedFiles, rule.whenChanged);

  if (affectedFiles.length === 0) {
    return undefined;
  }

  return {
    id: rule.id,
    area: "release",
    title: rule.title ?? `Custom release rule matched: ${rule.id}`,
    description: rule.description ?? `Files matching ${rule.whenChanged} changed.`,
    riskLevel: rule.risk,
    affectedFiles,
    whyItMatters: rule.whyItMatters ?? "This repository-defined rule marks the changed files as release-sensitive.",
    requiredBeforeDeploy: rule.requiredBeforeDeploy
  };
}

function customRulesWithRequiredTests(customRules: CustomRule[] | undefined): Array<CustomRule & { requiresTest: string }> {
  return (customRules ?? []).filter((rule): rule is CustomRule & { requiresTest: string } => rule.requiresTest !== undefined);
}

function customRulesWithReleaseActions(customRules: CustomRule[] | undefined): Array<CustomRule & { requiredBeforeDeploy: string[] }> {
  return (customRules ?? []).filter(
    (rule): rule is CustomRule & { requiredBeforeDeploy: string[] } => rule.requiredBeforeDeploy !== undefined
  );
}

function matchingActiveChangedFiles(changedFiles: ChangedFile[], pattern: string): string[] {
  return changedFiles
    .filter((file) => file.status !== "deleted" && matchesCustomRuleGlob(file.path, pattern))
    .map((file) => normalizePath(file.path))
    .sort((left, right) => left.localeCompare(right));
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === "*" && nextChar === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
