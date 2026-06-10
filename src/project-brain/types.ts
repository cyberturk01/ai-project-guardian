export const projectBrainDocumentNames = [
  "project",
  "architecture",
  "testingStrategy",
  "deploymentRules",
  "securityRules",
  "knownRisks",
  "knownBugs"
] as const;

export type ProjectBrainDocumentName = (typeof projectBrainDocumentNames)[number];

export type ProjectBrainDocument = {
  fileName: string;
  path: string;
  content: string;
};

export type ModuleMap = Record<string, unknown>;

export type ProjectBrain = {
  rootPath: string;
  documents: Partial<Record<ProjectBrainDocumentName, ProjectBrainDocument>>;
  moduleMap?: ModuleMap;
};
