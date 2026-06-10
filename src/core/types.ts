export const riskLevels = ["info", "low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof riskLevels)[number];

export type GuardianConfig = {
  projectName: string;
  riskFolders: string[];
  testFolders: string[];
  releaseSensitiveFiles: string[];
  requiredChecks: string[];
};

export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed";

export type ChangedFileCategory =
  | "source"
  | "test"
  | "migration"
  | "config"
  | "ci"
  | "documentation"
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
};

export type GuardianReport = {
  projectName: string;
  generatedAt: string;
  overallRisk: RiskLevel;
  changedFiles: ChangedFile[];
  qaFindings: QaFinding[];
  releaseFindings: ReleaseFinding[];
  securityFindings: SecurityFinding[];
  requiredActions: string[];
  warnings: string[];
};

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && riskLevels.includes(value as RiskLevel);
}
