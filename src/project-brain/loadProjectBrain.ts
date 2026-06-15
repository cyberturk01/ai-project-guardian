import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ModuleMap, ProjectBrain, ProjectBrainDocumentName } from "./types.js";

export const projectBrainDirectoryName = ".project-brain";

export const projectBrainMarkdownFiles: Record<ProjectBrainDocumentName, string> = {
  project: "project.md",
  architecture: "architecture.md",
  testingStrategy: "testing-strategy.md",
  deploymentRules: "deployment-rules.md",
  securityRules: "security-rules.md",
  knownRisks: "known-risks.md",
  knownBugs: "known-bugs.md"
};

export const moduleMapFileName = "module-map.json";

export type ProjectBrainLoadResult = {
  projectBrain: ProjectBrain;
  warnings: string[];
};

export function loadProjectBrain(repoPath: string): ProjectBrainLoadResult {
  const rootPath = join(resolve(repoPath), projectBrainDirectoryName);
  const warnings: string[] = [];
  const projectBrain: ProjectBrain = {
    rootPath,
    documents: {}
  };
  const missingFiles: string[] = [];

  if (!isDirectory(rootPath)) {
    return {
      projectBrain,
      warnings: ["Project Brain context was not found; continuing without repository-specific context."]
    };
  }

  for (const [name, fileName] of Object.entries(projectBrainMarkdownFiles)) {
    const path = join(rootPath, fileName);
    const content = readOptionalFile(path, fileName, missingFiles, warnings);

    if (content !== undefined) {
      projectBrain.documents[name as ProjectBrainDocumentName] = {
        fileName,
        path,
        content
      };
    }
  }

  const moduleMapPath = join(rootPath, moduleMapFileName);
  const moduleMapContent = readOptionalFile(moduleMapPath, moduleMapFileName, missingFiles, warnings);

  if (moduleMapContent !== undefined) {
    const moduleMap = parseModuleMap(moduleMapContent, moduleMapPath, warnings);

    if (moduleMap !== undefined) {
      projectBrain.moduleMap = moduleMap;
    }
  }

  if (missingFiles.length > 0) {
    warnings.unshift(`Project Brain context is incomplete; missing files: ${missingFiles.join(", ")}.`);
  }

  return { projectBrain, warnings };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch (error: unknown) {
    return false;
  }
}

function readOptionalFile(path: string, fileName: string, missingFiles: string[], warnings: string[]): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      missingFiles.push(fileName);
      return undefined;
    }

    warnings.push(`${path} could not be read; continuing without it.`);
    return undefined;
  }
}

function parseModuleMap(content: string, path: string, warnings: string[]): ModuleMap | undefined {
  try {
    const parsed: unknown = JSON.parse(content);

    if (isRecord(parsed)) {
      return parsed;
    }

    warnings.push(`${path} must contain a JSON object; continuing without module map.`);
    return undefined;
  } catch {
    warnings.push(`${path} contains invalid JSON; continuing without module map.`);
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
