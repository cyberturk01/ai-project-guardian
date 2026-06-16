import type { ActionableGuidanceItem, GuardianFinding, RiskLevel } from "./types.js";

const riskWeights: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const areaPriority: Record<ActionableGuidanceItem["area"], number> = {
  release: 0,
  security: 1,
  workflow: 2,
  qa: 3
};

export function buildRequiredDeployActions(releaseFindings: Array<Extract<GuardianFinding, { area: "release" }>>): string[] {
  return uniqueByNormalizedAction(releaseFindings.flatMap((finding) => finding.requiredBeforeDeploy));
}

export function buildActionableGuidance(findings: GuardianFinding[]): ActionableGuidanceItem[] {
  const items = findings.flatMap(guidanceItemsForFinding).filter((item) => normalizeAction(item.action) !== "");
  const byAction = new Map<string, ActionableGuidanceItem>();

  for (const item of items) {
    const key = normalizeAction(item.action);
    const existing = byAction.get(key);

    if (existing === undefined || compareGuidanceItems(item, existing) < 0) {
      byAction.set(key, item);
    }
  }

  return [...byAction.values()].sort(compareGuidanceItems).map((item, index) => ({
    ...item,
    id: `guidance-${index + 1}-${stableSlug(item.sourceFindingId)}`
  }));
}

function guidanceItemsForFinding(finding: GuardianFinding): ActionableGuidanceItem[] {
  if (finding.area === "release") {
    return finding.requiredBeforeDeploy.map((action, index) => baseGuidanceItem(finding, action, index));
  }

  if (finding.area === "qa") {
    const groupedAction = groupedQaGuidanceAction(finding);

    if (groupedAction !== undefined) {
      return [baseGuidanceItem(finding, groupedAction, 0)];
    }

    return finding.suggestedTests.map((action, index) => baseGuidanceItem(finding, action, index));
  }

  if (finding.recommendation === undefined) {
    return [];
  }

  return [baseGuidanceItem(finding, finding.recommendation, 0)];
}

function groupedQaGuidanceAction(finding: Extract<GuardianFinding, { area: "qa" }>): string | undefined {
  if (finding.testSignalEvidence !== undefined) {
    const scope = guidanceScope(finding.testSignalEvidence.changedFiles);
    const detection =
      finding.testSignalEvidence.detectedTestChanges.length === 0
        ? "no related test change was detected"
        : `related test changes detected: ${finding.testSignalEvidence.detectedTestChanges.join(", ")}`;
    const coverage = summarizeCoverage(finding.testSignalEvidence.suggestedCoverage);

    return `Review test coverage for ${scope}; ${detection}. Suggested coverage: ${coverage}.`;
  }

  if (finding.id === "qa-ui-without-cypress-test" && finding.affectedFiles.length > 1) {
    return "Add component tests for touched UI components, or Cypress/e2e coverage for page flows.";
  }

  if (finding.id === "qa-source-without-nearby-test" && finding.affectedFiles.length > 1) {
    return "Create or update nearby unit tests for touched source files.";
  }

  return undefined;
}

function guidanceScope(paths: string[]): string {
  if (paths.length === 0) {
    return "changed source files";
  }

  const directories = paths.map((path) => {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash === -1 ? "." : path.slice(0, lastSlash);
  });
  const sharedDirectory = directories[0];

  if (paths.length > 1 && sharedDirectory !== undefined && directories.every((directory) => directory === sharedDirectory)) {
    return `\`${sharedDirectory}/*\``;
  }

  if (paths.length === 1) {
    return `\`${paths[0]}\``;
  }

  return `${paths.slice(0, 3).map((path) => `\`${path}\``).join(", ")}${paths.length > 3 ? `, +${paths.length - 3} more` : ""}`;
}

function summarizeCoverage(coverage: string[]): string {
  const visibleCoverage = coverage.slice(0, 4);
  const suffix = coverage.length > visibleCoverage.length ? `, +${coverage.length - visibleCoverage.length} more` : "";

  return `${visibleCoverage.join(", ")}${suffix}`;
}

function baseGuidanceItem(finding: GuardianFinding, action: string, index: number): ActionableGuidanceItem {
  return {
    id: `guidance-${stableSlug(finding.id)}-${index + 1}`,
    sourceFindingId: finding.id,
    area: finding.area,
    riskLevel: finding.riskLevel,
    title: finding.title,
    action,
    ...("affectedFiles" in finding && finding.affectedFiles.length > 0 ? { affectedFiles: finding.affectedFiles } : {})
  };
}

function uniqueByNormalizedAction(actions: string[]): string[] {
  const seen = new Set<string>();
  const uniqueActions: string[] = [];

  for (const action of actions) {
    const normalizedAction = normalizeAction(action);

    if (normalizedAction === "" || seen.has(normalizedAction)) {
      continue;
    }

    seen.add(normalizedAction);
    uniqueActions.push(action);
  }

  return uniqueActions;
}

function compareGuidanceItems(left: ActionableGuidanceItem, right: ActionableGuidanceItem): number {
  return (
    riskWeights[right.riskLevel] - riskWeights[left.riskLevel] ||
    areaPriority[left.area] - areaPriority[right.area] ||
    left.title.localeCompare(right.title) ||
    left.action.localeCompare(right.action)
  );
}

function normalizeAction(action: string): string {
  return action.trim().replace(/\s+/g, " ").toLowerCase();
}

function stableSlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug === "" ? "item" : slug;
}
