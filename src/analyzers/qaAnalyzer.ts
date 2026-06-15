import { basename, dirname, extname } from "node:path";
import type { ChangedFile, GuardianConfig, QaFinding, RiskLevel } from "../core/types.js";
import type { ProjectBrain } from "../project-brain/types.js";
import { evaluateCustomQaRules } from "./customRuleEvaluator.js";

export type AnalyzeQaInput = {
  changedFiles: ChangedFile[];
  repoFiles: string[];
  config: GuardianConfig;
  projectBrain: ProjectBrain;
};

type QaRule = {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  matches: (file: ChangedFile, context: QaContext) => boolean;
  hasCoverage: (file: ChangedFile, context: QaContext) => boolean;
  suggestedTests: (file: ChangedFile, context: QaContext) => string[];
};

type QaContext = {
  repoFiles: string[];
  testFiles: string[];
  cypressFiles: string[];
  config: GuardianConfig;
  projectBrain: ProjectBrain;
};

const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".vue"
]);

const sourceLikeCategories = new Set(["source", "security", "i18n", "migration", "config", "unknown"]);
const testPathPattern = /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i;
const apiPathPattern = /(^|\/)(api|apis|routes?|controllers?|handlers?|endpoints?)(\/|$)|(\.|-|_)(route|routes|controller|handler|api)\.[^.]+$/i;
const uiPathPattern = /(^|\/)(components?|pages?|views?|screens?|ui|frontend|client|web|public)(\/|$)|(\.|-|_)(component|page|view|screen)\.[^.]+$/i;
const migrationPathPattern = /(^|\/)(migrations?|schema|prisma\/migrations)(\/|$)/i;
const i18nPathPattern = /(^|\/)(i18n|l10n|locales?|translations?|lang|messages)(\/|$)/i;
const authSecurityPathPattern = /(^|\/)(auth|authentication|authorization|crypto|jwt|oauth|password|permissions|secrets?|security|session)(\/|\.|-|_|$)/i;
const projectBrainPathPattern = /(^|\/)\.project-brain(\/|$)/i;
const apiTestPattern = /(^|\/)(api|integration|e2e|request|requests|supertest)(\/|\.|-|_)/i;
const dbTestPattern = /(^|\/)(db|database|integration|migrations?|repository|repositories)(\/|\.|-|_)/i;
const localizationTestPattern = /(^|\/)(i18n|l10n|localization|locales?|translations?)(\/|\.|-|_)/i;
const negativeSecurityTestPattern = /(^|\/)(auth|security|permissions?|authorization|session|jwt)(\/|\.|-|_).*(negative|invalid|forbidden|unauthorized|denied)|(\.|-|_)(negative|invalid|forbidden|unauthorized|denied)(\.|-|_)/i;

const qaRules: QaRule[] = [
  {
    id: "qa-source-without-nearby-test",
    title: "Source changed without nearby test coverage",
    description: "One or more source files changed, but no nearby unit or component test was found in the repository.",
    riskLevel: "medium",
    matches: (file) => isGenericSourceFile(file),
    hasCoverage: (file, context) => hasNearbyTest(file.path, context.testFiles, context.config),
    suggestedTests: (file) => [`Add or update a nearby unit test for ${file.path}.`]
  },
  {
    id: "qa-api-without-integration-test",
    title: "Route or API changed without API/integration test coverage",
    description: "A route, controller, handler, or API file changed without a matching API or integration test.",
    riskLevel: "high",
    matches: (file) => isProductionChangedCodeFile(file) && !isDocumentationContextFile(file) && apiPathPattern.test(normalizePath(file.path)),
    hasCoverage: (file, context) => hasTopicalTest(file.path, context.testFiles, apiTestPattern),
    suggestedTests: (file) => [`Add an API or integration test that exercises ${file.path}.`]
  },
  {
    id: "qa-ui-without-cypress-test",
    title: "UI changed without Cypress coverage",
    description: "A UI-facing file changed, but no relevant Cypress test was found in the repository.",
    riskLevel: "medium",
    matches: (file) => isProductionChangedCodeFile(file) && !isDocumentationContextFile(file) && uiPathPattern.test(normalizePath(file.path)),
    hasCoverage: (file, context) => hasTopicalTest(file.path, context.cypressFiles, /cypress|\.cy\./i),
    suggestedTests: (file) => [`Add or update a Cypress test for the UI behavior touched by ${file.path}.`]
  },
  {
    id: "qa-migration-without-db-test",
    title: "Migration changed without DB/integration test coverage",
    description: "A database migration or schema file changed without a matching database or integration test.",
    riskLevel: "high",
    matches: (file) =>
      isProductionChangedFile(file) &&
      !isDocumentationContextFile(file) &&
      (file.category === "migration" || migrationPathPattern.test(normalizePath(file.path))),
    hasCoverage: (file, context) => hasTopicalTest(file.path, context.testFiles, dbTestPattern),
    suggestedTests: (file) => [`Add a DB or integration test that validates the migration path for ${file.path}.`]
  },
  {
    id: "qa-i18n-without-localization-test",
    title: "i18n changed without localization test coverage",
    description: "Localization files changed without a matching localization test.",
    riskLevel: "low",
    matches: (file) => isProductionChangedFile(file) && (file.category === "i18n" || i18nPathPattern.test(normalizePath(file.path))),
    hasCoverage: (file, context) => hasTopicalTest(file.path, context.testFiles, localizationTestPattern),
    suggestedTests: (file) => [`Add a localization test that validates keys or rendering for ${file.path}.`]
  },
  {
    id: "qa-auth-security-without-negative-test",
    title: "Auth or security changed without negative test coverage",
    description: "Auth or security-sensitive code changed without a negative-path test for denied or invalid access.",
    riskLevel: "high",
    matches: (file) =>
      isProductionChangedFile(file) &&
      !isDocumentationContextFile(file) &&
      (file.category === "security" || authSecurityPathPattern.test(normalizePath(file.path))),
    hasCoverage: (file, context) => hasTopicalTest(file.path, context.testFiles, negativeSecurityTestPattern),
    suggestedTests: (file) => [`Add a negative test for invalid, forbidden, or unauthorized behavior around ${file.path}.`]
  }
];

export function analyzeQa(input: AnalyzeQaInput): QaFinding[] {
  const context: QaContext = {
    repoFiles: normalizeAndSort(input.repoFiles),
    testFiles: normalizeAndSort(input.repoFiles).filter(isTestFile),
    cypressFiles: normalizeAndSort(input.repoFiles).filter(isCypressTestFile),
    config: input.config,
    projectBrain: input.projectBrain
  };

  const builtInFindings = qaRules
    .map((rule) => buildFinding(rule, input.changedFiles, context))
    .filter((finding): finding is QaFinding => finding !== undefined);

  return [
    ...builtInFindings,
    ...evaluateCustomQaRules({
      changedFiles: input.changedFiles,
      repoFiles: input.repoFiles,
      customRules: input.config.customRules
    })
  ];
}

function buildFinding(rule: QaRule, changedFiles: ChangedFile[], context: QaContext): QaFinding | undefined {
  const affectedFiles = normalizeAndSort(
    changedFiles
      .filter((file) => rule.matches(file, context))
      .filter((file) => !rule.hasCoverage(file, context))
      .map((file) => file.path)
  );

  if (affectedFiles.length === 0) {
    return undefined;
  }

  const suggestedTests = suggestedTestsForAffectedFiles(rule, affectedFiles, context);

  return {
    id: rule.id,
    area: "qa",
    title: rule.title,
    description: rule.description,
    riskLevel: rule.riskLevel,
    affectedFiles,
    suggestedTests
  };
}

function suggestedTestsForAffectedFiles(rule: QaRule, affectedFiles: string[], context: QaContext): string[] {
  if (rule.id === "qa-source-without-nearby-test") {
    return [`Add or update nearby unit tests for affected source files: ${affectedFiles.join(", ")}.`];
  }

  if (rule.id === "qa-ui-without-cypress-test") {
    return [`Add or update Cypress coverage for affected UI files: ${affectedFiles.join(", ")}.`];
  }

  return uniqueSorted(
    affectedFiles.flatMap((path) =>
      rule.suggestedTests(
        {
          path,
          status: "modified",
          category: "source",
          riskLevel: rule.riskLevel
        },
        context
      )
    )
  );
}

function hasNearbyTest(path: string, testFiles: string[], config: GuardianConfig): boolean {
  const normalizedPath = normalizePath(path);
  const baseName = stripKnownExtensions(basename(normalizedPath));
  const sourceDirectory = dirname(normalizedPath);
  const mirroredPath = stripKnownExtensions(normalizedPath);
  const testFolders = config.testFolders.length > 0 ? config.testFolders.map(normalizePath) : ["tests", "test", "__tests__"];

  return testFiles.some((testFile) => {
    const normalizedTestFile = normalizePath(testFile);
    const testBaseName = stripKnownExtensions(basename(normalizedTestFile));

    return (
      testBaseName === baseName ||
      normalizedTestFile.startsWith(`${sourceDirectory}/`) && testBaseName.includes(baseName) ||
      normalizedTestFile.includes(`/${sourceDirectory}/__tests__/`) && testBaseName.includes(baseName) ||
      testFolders.some((folder) => normalizedTestFile.startsWith(`${folder}/`) && stripKnownExtensions(normalizedTestFile).includes(mirroredPath))
    );
  });
}

function hasTopicalTest(path: string, testFiles: string[], topicPattern: RegExp): boolean {
  const token = mainPathToken(path);

  return testFiles.some((testFile) => {
    const normalizedTestFile = normalizePath(testFile);

    return topicPattern.test(normalizedTestFile) && (token === "" || normalizedTestFile.toLowerCase().includes(token));
  });
}

function isGenericSourceFile(file: ChangedFile): boolean {
  if (!isChangedCodeFile(file)) {
    return false;
  }

  const normalizedPath = normalizePath(file.path);

  return (
    sourceLikeCategories.has(file.category) &&
    file.category === "source" &&
    !isTestFile(file.path) &&
    !apiPathPattern.test(normalizedPath) &&
    !uiPathPattern.test(normalizedPath) &&
    !authSecurityPathPattern.test(normalizedPath)
  );
}

function isChangedCodeFile(file: ChangedFile): boolean {
  return isActiveFile(file) && sourceExtensions.has(extname(file.path).toLowerCase());
}

function isProductionChangedCodeFile(file: ChangedFile): boolean {
  return isChangedCodeFile(file) && !isTestFile(file.path);
}

function isProductionChangedFile(file: ChangedFile): boolean {
  return isActiveFile(file) && !isTestFile(file.path);
}

function isDocumentationContextFile(file: ChangedFile): boolean {
  return file.category === "documentation" || file.category === "project-brain" || projectBrainPathPattern.test(normalizePath(file.path));
}

function isActiveFile(file: ChangedFile): boolean {
  return file.status !== "deleted";
}

function isTestFile(path: string): boolean {
  return testPathPattern.test(normalizePath(path));
}

function isCypressTestFile(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return /(^|\/)cypress(\/|$)|\.cy\.[^.]+$/i.test(normalizedPath);
}

function mainPathToken(path: string): string {
  return stripKnownExtensions(basename(normalizePath(path))).toLowerCase();
}

function stripKnownExtensions(path: string): string {
  return path
    .replace(/\.(test|spec|cy)$/i, "")
    .replace(/\.(controller|handler|route|routes|component|page|view|screen)$/i, "")
    .replace(/\.[^.]+$/i, "");
}

function normalizeAndSort(paths: string[]): string[] {
  return uniqueSorted(paths.map(normalizePath));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
