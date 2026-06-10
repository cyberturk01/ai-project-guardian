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

  return requiredChecks
    .filter((requiredCheck) => !commandRunsRequiredCheck(executedCommands, requiredCheck))
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

function commandRunsRequiredCheck(commands: string[], requiredCheck: string): boolean {
  const normalizedRequiredCheck = normalizeCommand(requiredCheck);

  return commands.some((command) => {
    const normalizedCommand = normalizeCommand(command);

    return normalizedCommand === normalizedRequiredCheck || normalizedCommand.startsWith(`${normalizedRequiredCheck} `);
  });
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
