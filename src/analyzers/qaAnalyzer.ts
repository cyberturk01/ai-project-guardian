import { basename, dirname, extname } from "node:path";
import type {
  ChangedFile,
  CoverageSignal,
  GuardianConfig,
  QaFinding,
  RelatedTestSignal,
  RiskLevel,
  TestRelatednessScore,
  TestSignalEvidence
} from "../core/types.js";
import type { ProjectBrain } from "../project-brain/types.js";
import { evaluateCustomQaRules } from "./customRuleEvaluator.js";

export type AnalyzeQaInput = {
  changedFiles: ChangedFile[];
  repoFiles: string[];
  config: GuardianConfig;
  projectBrain: ProjectBrain;
  testFileContents?: Record<string, string>;
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
  testFileContents: Record<string, string>;
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
const servicePathPattern = /(^|\/)(services?|domain|business|use-cases?|usecases?|interactors?|logic)(\/|$)|(\.|-|_)(service|usecase|interactor)\.[^.]+$/i;
const migrationPathPattern = /(^|\/)(migrations?|schema|prisma\/migrations)(\/|$)/i;
const i18nPathPattern = /(^|\/)(i18n|l10n|locales?|translations?|lang|messages)(\/|$)/i;
const authSecurityPathPattern = /(^|\/)(admin|auth|authentication|authorization|crypto|jwt|login|oauth|password|permissions?|roles?|secrets?|security|sessions?|tokens?)(\/|\.|-|_|$)/i;
const businessRiskPathPattern = /(^|\/)(billing|coupon|discount|loyalty|payment|quota|referrals?|rewards?)(\/|\.|-|_|$)/i;
const e2eRelevantPathPattern = /(^|\/)(auth|checkout|dashboard|forms?|loyalty|onboarding|pages?|public|referrals?|rewards?|routes?)(\/|\.|-|_|$)/i;
const projectBrainPathPattern = /(^|\/)\.project-brain(\/|$)/i;
const apiTestPattern = /(^|\/)(api|integration|e2e|request|requests|supertest)(\/|\.|-|_)/i;
const uiTestPattern = /(^|\/)(components?|pages?|views?|screens?|ui|frontend|client|web|e2e|cypress|playwright)(\/|\.|-|_)|(\.|-|_)(component|page|view|screen|cy|e2e)\.[^.]+$/i;
const dbTestPattern = /(^|\/)(db|database|integration|migrations?|repository|repositories)(\/|\.|-|_)/i;
const localizationTestPattern = /(^|\/)(i18n|l10n|localization|locales?|translations?)(\/|\.|-|_)/i;
const negativeSecurityTestPattern = /(^|\/)(auth|security|permissions?|authorization|session|jwt)(\/|\.|-|_).*(negative|invalid|forbidden|unauthorized|denied)|(\.|-|_)(negative|invalid|forbidden|unauthorized|denied)(\.|-|_)/i;

const qaRules: QaRule[] = [
  {
    id: "qa-source-without-nearby-test",
    title: "Source changed without nearby test coverage",
    description: "One or more source files changed, but no nearby unit test was found in the repository.",
    riskLevel: "medium",
    matches: (file) => isGenericSourceFile(file),
    hasCoverage: (file, context) => hasNearbyTest(file.path, context.testFiles, context.config),
    suggestedTests: (file) => [`Create or update a nearby unit test for ${file.path}.`]
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
    title: "UI changed without component or e2e coverage",
    description: "A UI-facing file changed, but no relevant component, Cypress, or e2e test was found in the repository.",
    riskLevel: "medium",
    matches: (file) => isProductionChangedCodeFile(file) && !isDocumentationContextFile(file) && uiPathPattern.test(normalizePath(file.path)),
    hasCoverage: (file, context) =>
      hasNearbyTest(file.path, context.testFiles, context.config) ||
      hasTopicalTest(file.path, context.testFiles, uiTestPattern) ||
      hasTopicalTest(file.path, context.cypressFiles, /cypress|\.cy\./i),
    suggestedTests: (file) => [`Add a component test or Cypress/e2e test for the UI behavior touched by ${file.path}.`]
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
    title: "Auth/security-sensitive files changed; negative-path coverage not confirmed",
    description: "Auth/security-sensitive files changed. Negative-path coverage was not confirmed.",
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
    projectBrain: input.projectBrain,
    testFileContents: normalizeTestFileContents(input.testFileContents ?? {})
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
  const testSignalEvidence = testSignalEvidenceForFinding(rule, affectedFiles, changedFiles, context);
  const description = descriptionForFinding(rule, testSignalEvidence);

  return {
    id: rule.id,
    area: "qa",
    title: rule.title,
    description,
    riskLevel: rule.riskLevel,
    affectedFiles,
    suggestedTests,
    testSignalEvidence
  };
}

function testSignalEvidenceForFinding(
  rule: QaRule,
  affectedFiles: string[],
  changedFiles: ChangedFile[],
  context: QaContext
): TestSignalEvidence {
  const expectedTestSignals = expectedTestSignalsForAffectedFiles(rule, affectedFiles);
  const changedTestFiles = normalizeAndSort(changedFiles.filter((file) => file.status !== "deleted").map((file) => file.path).filter(isTestFile));
  const detectedRelatedTests = relatedTestChanges(affectedFiles, changedTestFiles);
  const detectedTestChanges = detectedRelatedTests.map((test) => test.path);
  const detectedCoverageSignals = detectedCoverageSignalsForTests(detectedTestChanges, context.testFileContents);
  const unconfirmedCoverageSignals = unconfirmedCoverageSignalsForFinding(rule, detectedCoverageSignals);

  return {
    changedFiles: affectedFiles,
    expectedTestSignals,
    detectedTestChanges,
    detectedRelatedTests,
    detectedCoverageSignals,
    unconfirmedCoverageSignals,
    suggestedCoverage: suggestedCoverageForAffectedFiles(rule, affectedFiles),
    reason:
      detectedRelatedTests.length === 0
        ? "No related test change detected."
        : "Related test changes were detected; review whether they cover the changed behavior."
  };
}

function descriptionForFinding(rule: QaRule, evidence: TestSignalEvidence): string {
  if (rule.id !== "qa-auth-security-without-negative-test") {
    return rule.description;
  }

  if (evidence.detectedRelatedTests.length > 0) {
    return "Auth/security-sensitive files changed. Related tests were detected, but negative-path coverage was not confirmed.";
  }

  return "Auth/security-sensitive files changed. No related test signal was detected, so negative-path coverage could not be confirmed.";
}

function detectedCoverageSignalsForTests(testFiles: string[], testFileContents: Record<string, string>): CoverageSignal[] {
  const signals = new Set<CoverageSignal>();

  for (const testFile of testFiles) {
    const content = testFileContents[normalizePath(testFile)];

    if (content === undefined) {
      continue;
    }

    for (const signal of coverageSignalsForContent(content)) {
      signals.add(signal);
    }
  }

  return sortCoverageSignals([...signals]);
}

function coverageSignalsForContent(content: string): CoverageSignal[] {
  const normalizedContent = content.toLowerCase();
  const signals = new Set<CoverageSignal>();

  if (/\b(happy path|valid|success|succeed|resolves|returns?|ok|200)\b|\.to(equal|be|strictlyequal|deep\.equal)\b/.test(normalizedContent)) {
    signals.add("happy_path");
  }

  if (/\b(tothrow|rejects|throws?|invalid|errors?|failure|fails?|exception|denied|forbidden|unauthorized)\b/.test(normalizedContent)) {
    signals.add("error_path");
  }

  if (/\b(regression|bug|fix(?:ed|es)?|previously|repro(?:duce|duces|duction)?)\b/.test(normalizedContent)) {
    signals.add("regression");
  }

  if (/\b(snapshot|golden|contract|schema|output contract)\b|tomatchsnapshot/.test(normalizedContent)) {
    signals.add("output_contract");
  }

  if (/\b(auth(?:orization|entication)?|permission|role|forbidden|unauthorized|denied|access control)\b/.test(normalizedContent)) {
    signals.add("authorization");
  }

  if (/\b(validation|validate|invalid|required|malformed|schema)\b/.test(normalizedContent)) {
    signals.add("validation");
  }

  if (/\b(boundary|edge case|limit|quota|minimum|maximum|min|max|overflow|underflow|empty|zero)\b/.test(normalizedContent)) {
    signals.add("boundary");
  }

  return sortCoverageSignals([...signals]);
}

function unconfirmedCoverageSignalsForFinding(rule: QaRule, detectedSignals: CoverageSignal[]): CoverageSignal[] {
  const expectedSignals = expectedCoverageSignalsForRule(rule);
  const detected = new Set(detectedSignals);

  return sortCoverageSignals(expectedSignals.filter((signal) => !detected.has(signal)));
}

function expectedCoverageSignalsForRule(rule: QaRule): CoverageSignal[] {
  if (rule.id === "qa-auth-security-without-negative-test") {
    return ["negative_path", "authorization"];
  }

  if (rule.id === "qa-api-without-integration-test") {
    return ["happy_path", "error_path", "validation"];
  }

  if (rule.id === "qa-ui-without-cypress-test") {
    return ["happy_path", "validation"];
  }

  if (rule.id === "qa-migration-without-db-test") {
    return ["happy_path", "boundary"];
  }

  if (rule.id === "qa-i18n-without-localization-test") {
    return ["happy_path", "error_path"];
  }

  return ["happy_path", "regression"];
}

function expectedTestSignalsForAffectedFiles(rule: QaRule, affectedFiles: string[]): string[] {
  if (affectedFiles.length > 1) {
    const groupedSignals = groupedExpectedSignals(rule, affectedFiles);

    if (groupedSignals.length > 0) {
      return groupedSignals;
    }
  }

  return uniqueSorted(affectedFiles.flatMap((path) => expectedTestSignalsForFile(rule, path)));
}

function groupedExpectedSignals(rule: QaRule, affectedFiles: string[]): string[] {
  const sharedDirectory = commonDirectory(affectedFiles);

  if (sharedDirectory === undefined || sharedDirectory === "." || sharedDirectory === "") {
    return [];
  }

  const feature = basename(sharedDirectory);
  const extensions = expectedTestExtensions(affectedFiles);
  const signals = extensions.flatMap((extension) => [`${sharedDirectory}/*.test${extension}`, `${sharedDirectory}/*.spec${extension}`]);
  signals.push(`tests/${feature}/*`);

  if (rule.id === "qa-ui-without-cypress-test" || affectedFiles.some(isE2eRelevantPath)) {
    signals.push(`cypress/e2e/${feature}.cy.ts`, `cypress/e2e/${feature}.cy.js`, `e2e/${feature}.spec.ts`);
  }

  return uniqueSorted(signals);
}

function expectedTestSignalsForFile(rule: QaRule, path: string): string[] {
  const normalizedPath = normalizePath(path);
  const directory = dirname(normalizedPath);
  const base = stripKnownExtensions(basename(normalizedPath));
  const withoutExtension = stripKnownExtensions(normalizedPath);
  const testExtension = preferredTestExtension(path);
  const testPath = withoutExtension.startsWith("src/") ? withoutExtension.slice("src/".length) : withoutExtension;
  const signals = [
    `${withoutExtension}.test${testExtension}`,
    `${withoutExtension}.spec${testExtension}`,
    `tests/${testPath}.test${testExtension}`,
    `tests/${base}.test${testExtension}`
  ];

  if (rule.id === "qa-api-without-integration-test") {
    signals.push(`tests/${testPath}.test${testExtension}`, `${directory}/${base}.test${testExtension}`);
  }

  if (rule.id === "qa-ui-without-cypress-test" || isE2eRelevantPath(normalizedPath)) {
    const feature = featureToken(normalizedPath);
    signals.push(`cypress/e2e/${feature}.cy.ts`, `cypress/e2e/${feature}.cy.js`, `e2e/${feature}.spec.ts`);
  }

  return uniqueSorted(signals);
}

function relatedTestChanges(affectedFiles: string[], changedTestFiles: string[]): RelatedTestSignal[] {
  return changedTestFiles
    .map((testFile) => {
      const score = bestRelatednessScore(affectedFiles, testFile);
      return score === undefined ? undefined : { path: testFile, score };
    })
    .filter((test): test is RelatedTestSignal => test !== undefined)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function bestRelatednessScore(affectedFiles: string[], testFile: string): TestRelatednessScore | undefined {
  const scores = affectedFiles
    .map((sourceFile) => relatednessScore(sourceFile, testFile))
    .filter((score): score is TestRelatednessScore => score !== undefined);

  if (scores.includes("strong")) {
    return "strong";
  }

  if (scores.includes("medium")) {
    return "medium";
  }

  if (scores.includes("weak")) {
    return "weak";
  }

  return undefined;
}

function relatednessScore(sourceFile: string, testFile: string): TestRelatednessScore | undefined {
  const normalizedTestFile = normalizePath(testFile).toLowerCase();
  const normalizedSourceFile = normalizePath(sourceFile).toLowerCase();
  const testBaseToken = stripKnownExtensions(basename(normalizedTestFile)).toLowerCase();
  const sourceToken = mainPathToken(sourceFile).toLowerCase();
  const feature = featureToken(sourceFile).toLowerCase();
  const folderToken = basename(dirname(normalizePath(sourceFile))).toLowerCase();

  if (
    sourceToken !== "" &&
    (testBaseToken === sourceToken || testBaseToken.includes(sourceToken) || normalizedTestFile.includes(`/${sourceToken}.`))
  ) {
    return "strong";
  }

  if (
    isMirroredTestPath(normalizedSourceFile, normalizedTestFile) ||
    feature !== "" && normalizedTestFile.includes(`/${feature}/`) ||
    folderToken !== "" && folderToken !== "." && normalizedTestFile.includes(`/${folderToken}/`)
  ) {
    return "medium";
  }

  const sourceKeywords = featureKeywords(sourceFile);
  const testKeywords = featureKeywords(testFile);

  return sourceKeywords.some((keyword) => testKeywords.includes(keyword)) ? "weak" : undefined;
}

function isMirroredTestPath(sourceFile: string, testFile: string): boolean {
  const sourceWithoutExtension = stripKnownExtensions(sourceFile);
  const withoutSrc = sourceWithoutExtension.startsWith("src/") ? sourceWithoutExtension.slice("src/".length) : sourceWithoutExtension;
  const testWithoutExtension = stripKnownExtensions(testFile);

  return testWithoutExtension.includes(sourceWithoutExtension) || testWithoutExtension.includes(withoutSrc);
}

function featureKeywords(path: string): string[] {
  return normalizePath(path)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["spec", "test", "tests", "src", "source"].includes(token));
}

function suggestedCoverageForAffectedFiles(rule: QaRule, affectedFiles: string[]): string[] {
  const coverage = new Set<string>(["happy path"]);

  if (rule.id === "qa-api-without-integration-test") {
    coverage.add("API/integration path");
    coverage.add("invalid input/error path");
  } else if (rule.id === "qa-ui-without-cypress-test") {
    coverage.add("component rendering path");
    coverage.add("validation/error path");
  } else if (rule.id === "qa-migration-without-db-test") {
    coverage.add("migration apply path");
    coverage.add("rollback or compatibility path");
  } else if (rule.id === "qa-i18n-without-localization-test") {
    coverage.add("localized rendering path");
    coverage.add("missing key fallback");
  } else {
    coverage.add("validation/error path");
  }

  if (affectedFiles.some((path) => authSecurityPathPattern.test(normalizePath(path)))) {
    coverage.add("negative unauthorized path");
    coverage.add("role/permission denial");
    coverage.add("invalid token/session case");
  }

  if (affectedFiles.some((path) => businessRiskPathPattern.test(normalizePath(path)))) {
    coverage.add("duplicate/abuse prevention");
    coverage.add("limit/quota boundary");
    coverage.add("invalid input/error path");
  }

  coverage.add("regression test if this change fixes a bug");

  return [...coverage].sort((left, right) => left.localeCompare(right));
}

function suggestedTestsForAffectedFiles(rule: QaRule, affectedFiles: string[], context: QaContext): string[] {
  if (rule.id === "qa-source-without-nearby-test") {
    const sourceType = affectedFiles.every(isServiceOrBusinessLogicPath) ? "service/business logic" : "source";

    return [`Create or update nearby unit tests for touched ${sourceType} files (${summarizePaths(affectedFiles)}).`];
  }

  if (rule.id === "qa-ui-without-cypress-test") {
    return [`Add component tests for touched UI components, or Cypress/e2e coverage for page flows (${summarizePaths(affectedFiles)}).`];
  }

  if (rule.id === "qa-api-without-integration-test" && affectedFiles.length > 1) {
    return [`Add API/integration tests for touched routes, controllers, or handlers (${summarizePaths(affectedFiles)}).`];
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

function isServiceOrBusinessLogicPath(path: string): boolean {
  return servicePathPattern.test(normalizePath(path));
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
  const normalizedPath = normalizePath(path);
  const directToken = stripKnownExtensions(basename(normalizedPath)).toLowerCase();

  if (directToken !== "" && !isGenericRouteFileToken(directToken)) {
    return directToken;
  }

  return stripKnownExtensions(basename(dirname(normalizedPath))).toLowerCase();
}

function commonDirectory(paths: string[]): string | undefined {
  const directories = paths.map((path) => dirname(normalizePath(path)));
  const firstDirectory = directories[0];

  if (firstDirectory === undefined || directories.some((directory) => directory !== firstDirectory)) {
    return undefined;
  }

  return firstDirectory;
}

function expectedTestExtensions(paths: string[]): string[] {
  return uniqueSorted(paths.map(preferredTestExtension));
}

function preferredTestExtension(path: string): string {
  const extension = extname(path).toLowerCase();

  if (extension === ".tsx" || extension === ".jsx") {
    return extension;
  }

  return ".ts";
}

function featureToken(path: string): string {
  const token = mainPathToken(path);

  if (token !== "") {
    return token;
  }

  return basename(dirname(normalizePath(path))).toLowerCase();
}

function isE2eRelevantPath(path: string): boolean {
  return e2eRelevantPathPattern.test(normalizePath(path));
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

function normalizeTestFileContents(contents: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(contents).map(([path, content]) => [normalizePath(path), content]));
}

function sortCoverageSignals(signals: CoverageSignal[]): CoverageSignal[] {
  const order: CoverageSignal[] = [
    "happy_path",
    "error_path",
    "regression",
    "output_contract",
    "authorization",
    "validation",
    "boundary",
    "negative_path"
  ];
  const rank = new Map(order.map((signal, index) => [signal, index]));

  return [...new Set(signals)].sort((left, right) => (rank.get(left) ?? 999) - (rank.get(right) ?? 999));
}

function summarizePaths(paths: string[]): string {
  const visiblePaths = paths.slice(0, 4);
  const hiddenCount = paths.length - visiblePaths.length;
  const suffix = hiddenCount > 0 ? `, +${hiddenCount} more` : "";

  return `examples: ${visiblePaths.join(", ")}${suffix}`;
}

function isGenericRouteFileToken(token: string): boolean {
  return ["api", "controller", "handler", "index", "route", "routes"].includes(token);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
