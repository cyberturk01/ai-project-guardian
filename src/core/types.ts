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
  filePath?: string;
  recommendation?: string;
  accepted?: boolean;
};

export type QaFinding = FindingBase & {
  area: "qa";
  affectedFiles: string[];
  suggestedTests: string[];
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

export type GuardianReport = {
  projectName: string;
  generatedAt: string;
  riskScore: number;
  overallRisk: RiskLevel;
  changedFiles: ChangedFile[];
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  workflowFindings: WorkflowFinding[];
  acceptedFindings: GuardianFinding[];
  requiredActions: string[];
  warnings: string[];
};

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && riskLevels.includes(value as RiskLevel);
}
