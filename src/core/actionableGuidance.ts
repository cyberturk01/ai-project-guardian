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
    return finding.suggestedTests.map((action, index) => baseGuidanceItem(finding, action, index));
  }

  if (finding.recommendation === undefined) {
    return [];
  }

  return [baseGuidanceItem(finding, finding.recommendation, 0)];
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
