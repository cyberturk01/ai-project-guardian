import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GuardianConfig, WorkflowFinding } from "../core/types.js";

export type AnalyzeWorkflowsInput = {
  repoPath: string;
  repoFiles: string[];
  config: GuardianConfig;
};

type WorkflowCommands = {
  workflowFile: string;
  commands: string[];
};

export async function analyzeWorkflows(input: AnalyzeWorkflowsInput): Promise<WorkflowFinding[]> {
  const requiredChecks = uniqueNonEmpty(input.config.requiredChecks);

  if (requiredChecks.length === 0) {
    return [];
  }

  const workflows = await readWorkflowCommands(input.repoPath, input.repoFiles);
  const executedCommands = workflows.flatMap((workflow) => workflow.commands);
  const delegatedEvidence = await readDelegatedCommandEvidence(input.repoPath, input.repoFiles, executedCommands);

  return requiredChecks
    .filter((requiredCheck) => !commandRunsRequiredCheck(executedCommands, delegatedEvidence, requiredCheck))
    .map((missingCheck) => {
      return {
        id: `workflow-missing-required-check-${slugify(missingCheck)}`,
        area: "workflow",
        title: "Required workflow check is missing",
        description: `No GitHub Actions workflow command runs the required check: ${missingCheck}.`,
        riskLevel: "high",
        missingCheck,
        workflowFile: workflowLocation(workflows),
        recommendation: "Add the required check to a GitHub Actions workflow that runs before merge or release."
      };
    });
}

export function extractWorkflowCommands(workflowYaml: string): string[] {
  const lines = workflowYaml.replaceAll("\r\n", "\n").split("\n");
  const commands: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const runMatch = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);

    if (runMatch === null) {
      continue;
    }

    const runIndent = runMatch[1].length;
    const value = runMatch[2].trim();

    if (value === "|" || value === "|-" || value === "|+" || value === ">" || value === ">-" || value === ">+") {
      const blockLines: string[] = [];

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];

        if (nextLine.trim() !== "" && leadingSpaces(nextLine) <= runIndent) {
          break;
        }

        index += 1;
        blockLines.push(nextLine);
      }

      commands.push(...extractShellCommands(blockLines.map((blockLine) => blockLine.trim()).join("\n")));
      continue;
    }

    commands.push(...extractShellCommands(stripYamlQuotes(value)));
  }

  return commands;
}

async function readWorkflowCommands(repoPath: string, repoFiles: string[]): Promise<WorkflowCommands[]> {
  const workflowFiles = repoFiles.filter(isWorkflowFile);
  const workflows: WorkflowCommands[] = [];

  for (const workflowFile of workflowFiles) {
    const content = await readFile(join(repoPath, workflowFile), "utf8");

    workflows.push({
      workflowFile,
      commands: extractWorkflowCommands(content)
    });
  }

  return workflows;
}

function extractShellCommands(commandText: string): string[] {
  return commandText
    .split(/\n|&&|\|\||;/)
    .map((command) => command.trim())
    .filter((command) => command !== "" && !command.startsWith("#"));
}

async function readDelegatedCommandEvidence(repoPath: string, repoFiles: string[], commands: string[]): Promise<string[]> {
  const packageScripts = await readPackageScripts(repoPath, repoFiles);
  const evidence: string[] = [];
  const visitedScripts = new Set<string>();

  for (const command of commands) {
    evidence.push(...(await expandPackageScriptEvidence(repoPath, repoFiles, packageScripts, command, visitedScripts)));
  }

  return evidence;
}

async function expandPackageScriptEvidence(
  repoPath: string,
  repoFiles: string[],
  packageScripts: Record<string, string>,
  command: string,
  visitedScripts: Set<string>
): Promise<string[]> {
  const scriptName = npmRunScriptName(command);

  if (scriptName === undefined || visitedScripts.has(scriptName)) {
    return [];
  }

  visitedScripts.add(scriptName);

  const scriptCommand = packageScripts[scriptName];

  if (scriptCommand === undefined) {
    return [];
  }

  const evidence = [scriptCommand];
  const nestedCommands = extractShellCommands(scriptCommand);

  for (const nestedCommand of nestedCommands) {
    evidence.push(...(await expandPackageScriptEvidence(repoPath, repoFiles, packageScripts, nestedCommand, visitedScripts)));
    const scriptPath = localNodeScriptPath(nestedCommand);

    if (scriptPath !== undefined && repoFiles.includes(scriptPath)) {
      evidence.push(await readFile(join(repoPath, scriptPath), "utf8"));
    }
  }

  return evidence;
}

async function readPackageScripts(repoPath: string, repoFiles: string[]): Promise<Record<string, string>> {
  if (!repoFiles.includes("package.json")) {
    return {};
  }

  try {
    const packageJson = JSON.parse(await readFile(join(repoPath, "package.json"), "utf8")) as { scripts?: unknown };

    if (packageJson.scripts === undefined || packageJson.scripts === null || typeof packageJson.scripts !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(packageJson.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

function npmRunScriptName(command: string): string | undefined {
  const match = normalizeCommand(command).match(/^npm (?:run |run-script )([^-\s][^\s]*)/);

  return match?.[1];
}

function localNodeScriptPath(command: string): string | undefined {
  const match = normalizeCommand(command).match(/^node (?:--[^\s]+ )*([^\s]+\.([cm]?js|ts))(\s|$)/);
  const scriptPath = match?.[1];

  if (scriptPath === undefined || scriptPath.startsWith("/") || scriptPath.startsWith("..")) {
    return undefined;
  }

  return scriptPath.replace(/^\.\//, "");
}

function commandRunsRequiredCheck(commands: string[], delegatedEvidence: string[], requiredCheck: string): boolean {
  const normalizedRequiredCheck = normalizeCommand(requiredCheck);

  return commands.some((command) => {
    const normalizedCommand = normalizeCommand(command);

    return normalizedCommand === normalizedRequiredCheck || normalizedCommand.startsWith(`${normalizedRequiredCheck} `);
  }) || delegatedEvidence.some((evidence) => normalizeCommand(evidence).includes(normalizedRequiredCheck));
}

function normalizeCommand(command: string): string {
  return stripYamlQuotes(command).replace(/\s+/g, " ").trim();
}

function stripYamlQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isWorkflowFile(path: string): boolean {
  return /^\.github\/workflows\/[^/]+\.(ya?ml)$/i.test(path);
}

function workflowLocation(workflows: WorkflowCommands[]): string {
  if (workflows.length === 0) {
    return ".github/workflows";
  }

  return workflows.map((workflow) => workflow.workflowFile).join(", ");
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value !== ""))];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function leadingSpaces(value: string): number {
  return value.length - value.trimStart().length;
}
