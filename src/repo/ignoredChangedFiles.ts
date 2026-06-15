export const defaultIgnoredChangedFilePatterns = [
  "guardian-report.md",
  "guardian-summary.md",
  "guardian-*.md",
  "*.tgz",
  "*.tar.gz",
  "npm-debug.log*",
  ".DS_Store",
  "dist/**",
  "coverage/**",
  ".next/**",
  "node_modules/**"
] as const;

const ignoredRootFolders = new Set(["dist", "coverage", ".next", "node_modules"]);

export function isIgnoredChangedFile(path: string): boolean {
  const normalizedPath = normalizePath(path);
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;

  return (
    normalizedPath === "guardian-report.md" ||
    normalizedPath === "guardian-summary.md" ||
    /^guardian-.*\.md$/i.test(normalizedPath) ||
    fileName.endsWith(".tgz") ||
    fileName.endsWith(".tar.gz") ||
    /^npm-debug\.log/i.test(fileName) ||
    fileName === ".DS_Store" ||
    ignoredRootFolders.has(normalizedPath.split("/")[0] ?? "")
  );
}

export function filterIgnoredChangedFiles<T extends { path: string; previousPath?: string }>(changedFiles: T[]): T[] {
  return changedFiles.filter((file) => !isIgnoredChangedFile(file.path) && !isIgnoredChangedFile(file.previousPath ?? ""));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
