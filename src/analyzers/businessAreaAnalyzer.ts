import type { BusinessArea, ChangedFile, GuardianConfig, QaFinding, ReleaseFinding } from "../core/types.js";

export type AnalyzeBusinessAreasInput = {
  changedFiles: ChangedFile[];
  repoFiles: string[];
  config: GuardianConfig;
};

export type BusinessAreaFindings = {
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
};

const testPathPattern = /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i;

export function analyzeBusinessAreas(input: AnalyzeBusinessAreasInput): BusinessAreaFindings {
  const businessAreas = input.config.businessAreas ?? [];

  if (businessAreas.length === 0) {
    return {
      qaFindings: [],
      releaseFindings: []
    };
  }

  const testFiles = candidateTestFiles(input.repoFiles, input.changedFiles);
  const qaFindings: QaFinding[] = [];
  const releaseFindings: ReleaseFinding[] = [];

  for (const businessArea of businessAreas) {
    const affectedFiles = matchingChangedFiles(businessArea, input.changedFiles);

    if (affectedFiles.length === 0) {
      continue;
    }

    const requiredTestHints = normalizeHints(businessArea.requiredTestHints);
    const requiredBeforeDeploy = uniqueSorted(businessArea.requiredBeforeDeploy ?? []);

    if (requiredTestHints.length > 0 && !hasMatchingTestHint(requiredTestHints, testFiles)) {
      qaFindings.push(buildQaFinding(businessArea, affectedFiles, requiredTestHints));
    }

    if (requiredBeforeDeploy.length > 0) {
      releaseFindings.push(buildReleaseFinding(businessArea, affectedFiles, requiredBeforeDeploy));
    }
  }

  return {
    qaFindings,
    releaseFindings
  };
}

function buildQaFinding(area: BusinessArea, affectedFiles: string[], requiredTestHints: string[]): QaFinding {
  return {
    id: `business-area-${slugify(area.name)}-missing-tests`,
    area: "qa",
    title: `Business area changed without matching tests: ${area.name}`,
    description: area.description ?? `The ${area.name} business area changed without a matching configured test hint.`,
    riskLevel: area.riskLevel,
    affectedFiles,
    suggestedTests: requiredTestHints.map((hint) => `Add or update a test covering "${hint}" behavior for the ${area.name} business area.`)
  };
}

function buildReleaseFinding(area: BusinessArea, affectedFiles: string[], requiredBeforeDeploy: string[]): ReleaseFinding {
  return {
    id: `business-area-${slugify(area.name)}-required-before-deploy`,
    area: "release",
    title: `Business area changed with required deploy checks: ${area.name}`,
    description: area.description ?? `The ${area.name} business area changed and has configured pre-deploy checks.`,
    riskLevel: area.riskLevel,
    affectedFiles,
    whyItMatters: area.description ?? `Changes to ${area.name} can affect project-specific business behavior.`,
    requiredBeforeDeploy
  };
}

function matchingChangedFiles(area: BusinessArea, changedFiles: ChangedFile[]): string[] {
  return uniqueSorted(
    changedFiles
      .map((file) => normalizePath(file.path))
      .filter((path) => area.paths.some((configuredPath) => matchesBusinessAreaPath(path, configuredPath)))
  );
}

export function matchesBusinessAreaPath(filePath: string, configuredPath: string): boolean {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedConfiguredPath = normalizePath(configuredPath);

  if (normalizedConfiguredPath === "") {
    return false;
  }

  return (
    normalizedFilePath === normalizedConfiguredPath ||
    normalizedFilePath.startsWith(`${normalizedConfiguredPath}/`) ||
    normalizedFilePath.includes(normalizedConfiguredPath)
  );
}

function candidateTestFiles(repoFiles: string[], changedFiles: ChangedFile[]): string[] {
  return uniqueSorted([
    ...repoFiles.map(normalizePath).filter(isTestFile),
    ...changedFiles.map((file) => normalizePath(file.path)).filter(isTestFile)
  ]);
}

function hasMatchingTestHint(requiredTestHints: string[], testFiles: string[]): boolean {
  return testFiles.some((file) => {
    const normalizedFile = file.toLowerCase();

    return requiredTestHints.some((hint) => normalizedFile.includes(hint));
  });
}

function normalizeHints(hints: string[] | undefined): string[] {
  return uniqueSorted((hints ?? []).map((hint) => hint.trim().toLowerCase()).filter((hint) => hint !== ""));
}

function isTestFile(path: string): boolean {
  return testPathPattern.test(normalizePath(path));
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug === "" ? "unnamed" : slug;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
