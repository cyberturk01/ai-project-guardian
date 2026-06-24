export const riskLevels = ["info", "low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof riskLevels)[number];

export type BusinessArea = {
  name: string;
  description?: string;
  riskLevel: RiskLevel;
  paths: string[];
  requiredTestHints?: string[];
  requiredBeforeDeploy?: string[];
};

export type CustomRule = {
  id: string;
  whenChanged: string;
  requiresTest?: string;
  risk: RiskLevel;
  title?: string;
  description?: string;
  requiredBeforeDeploy?: string[];
  whyItMatters?: string;
};

export type GuardianConfig = {
  projectName: string;
  riskFolders: string[];
  testFolders: string[];
  releaseSensitiveFiles: string[];
  requiredChecks: string[];
  coverageThreshold: number;
  businessAreas?: BusinessArea[];
  customRules?: CustomRule[];
};

export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed";

export type ChangedFileCategory =
  | "source"
  | "test"
  | "migration"
  | "config"
  | "ci"
  | "documentation"
  | "project-brain"
  | "generated-report"
  | "i18n"
  | "security"
  | "unknown";

export type ChangedFile = {
  path: string;
  previousPath?: string;
  status: ChangedFileStatus;
  category: ChangedFileCategory;
  riskLevel: RiskLevel;
};

export type FindingBase = {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  confidence?: number;
  filePath?: string;
  recommendation?: string;
  accepted?: boolean;
};

export type TestRelatednessScore = "strong" | "medium" | "weak";
export type CoverageSignal =
  | "happy_path"
  | "error_path"
  | "regression"
  | "output_contract"
  | "authorization"
  | "validation"
  | "boundary"
  | "negative_path";

export type RelatedTestSignal = {
  path: string;
  score: TestRelatednessScore;
};

export type TestSignalEvidence = {
  changedFiles: string[];
  expectedTestSignals: string[];
  detectedTestChanges: string[];
  detectedRelatedTests: RelatedTestSignal[];
  detectedCoverageSignals: CoverageSignal[];
  unconfirmedCoverageSignals: CoverageSignal[];
  suggestedCoverage: string[];
  reason: string;
};

export type QaFinding = FindingBase & {
  area: "qa";
  affectedFiles: string[];
  suggestedTests: string[];
  testSignalEvidence?: TestSignalEvidence;
};

export type ReleaseFinding = FindingBase & {
  area: "release";
  affectedFiles: string[];
  whyItMatters: string;
  requiredBeforeDeploy: string[];
};

export type SecurityFinding = FindingBase & {
  area: "security";
  lineNumber?: number;
};

export type WorkflowFinding = FindingBase & {
  area: "workflow";
  missingCheck: string;
  workflowFile: string;
};

export type GuardianFinding = QaFinding | ReleaseFinding | SecurityFinding | WorkflowFinding;

export type ActionableGuidanceItem = {
  id: string;
  sourceFindingId: string;
  area: "qa" | "release" | "security" | "workflow";
  riskLevel: RiskLevel;
  title: string;
  action: string;
  affectedFiles?: string[];
};

export type ScoreBreakdown = {
  selectedBand: string;
  bandBase: number;
  bandMax: number;
  bandFactor: number;
  weightedSignal: number;
  changedFileScore: number;
  qaFindingScore: number;
  releaseFindingScore: number;
  securityFindingScore: number;
  workflowFindingScore: number;
  externalFindingScore: number;
  correlatedFindingScore: number;
  criticalFloorApplied?: {
    applied: boolean;
    floor?: number;
    reason?: string;
  };
};

export type ExternalScanner = "sarif" | "codeql" | "semgrep" | "snyk";

export type ExternalFinding = {
  id: string;
  source: ExternalScanner | string;
  ruleId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  filePath?: string;
  lineNumber?: number;
  artifactPath: string;
};

export type CorrelatedFinding = {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  filePath?: string;
  lineNumber?: number;
  sources: string[];
  findingIds: string[];
  confidence: "single-tool" | "multi-tool";
};

export type MergeRecommendation = "blocked" | "safe_after_checklist" | "safe" | "review_required";

export type EnterpriseRiskCorrelation = {
  externalFindings: ExternalFinding[];
  correlatedFindings: CorrelatedFinding[];
  importedArtifacts: string[];
  warnings: string[];
};

export type GuardianReport = {
  projectName: string;
  generatedAt: string;
  riskScore: number;
  overallRisk: RiskLevel;
  blockingFindingsCount: number;
  checklistFindingsCount: number;
  mergeRecommendation: MergeRecommendation;
  codeRisk: RiskLevel;
  releaseChecklistRisk: RiskLevel;
  riskReason: string;
  scoreBreakdown: ScoreBreakdown;
  changedFiles: ChangedFile[];
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  workflowFindings: WorkflowFinding[];
  enterpriseRiskCorrelation: EnterpriseRiskCorrelation;
  acceptedFindings: GuardianFinding[];
  requiredDeployActions: string[];
  actionableGuidance: ActionableGuidanceItem[];
  requiredActions: string[];
  warnings: string[];
};

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && riskLevels.includes(value as RiskLevel);
}
