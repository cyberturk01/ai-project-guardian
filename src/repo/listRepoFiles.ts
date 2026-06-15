import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { runGitCommand } from "./gitRunner.js";

const ignoredDirectories = new Set([".git", "dist", "node_modules"]);

export type ListRepoFilesOptions = {
  repoPath: string;
};

export async function listRepoFiles(options: ListRepoFilesOptions): Promise<string[]> {
  try {
    const { stdout } = await runGitCommand({
      command: "git",
      args: ["ls-files"],
      cwd: options.repoPath
    });

    return normalizeAndSort(stdout.split(/\r?\n/).filter((path) => path.length > 0));
  } catch {
    return normalizeAndSort(await walkFiles(options.repoPath, options.repoPath));
  }
}

async function walkFiles(rootPath: string, currentPath: string): Promise<string[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkFiles(rootPath, entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(rootPath, entryPath));
    }
  }

  return files;
}

function normalizeAndSort(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.replaceAll("\\", "/")))].sort((left, right) => left.localeCompare(right));
}
