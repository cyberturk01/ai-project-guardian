import { readFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";
import type { ChangedFile, QaFinding } from "../core/types.js";

export type AnalyzeCoverageInput = {
  repoPath: string;
  changedFiles: ChangedFile[];
  coverageThreshold: number;
  readFile?: (path: string) => Promise<string>;
};

type CoverageEntry = {
  path: string;
  percent: number;
};

const coverageFiles = ["coverage-final.json", "coverage/coverage-final.json", "lcov.info", "coverage/lcov.info"];
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"]);
const testPathPattern = /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i;

export async function analyzeCoverage(input: AnalyzeCoverageInput): Promise<QaFinding[]> {
  const coverage = await loadCoverage(input);
  const affectedFiles = input.changedFiles
    .filter(isProductionCodeFile)
    .map((file) => normalizePath(file.path))
    .filter((path) => {
      const percent = coverage.get(path);
      return percent !== undefined && percent < input.coverageThreshold;
    })
    .sort((left, right) => left.localeCompare(right));

  if (affectedFiles.length === 0) {
    return [];
  }

  return [
    {
      id: "low-coverage-changed-code",
      area: "qa",
      title: "Changed code has low test coverage",
      description: `One or more changed source files are below the configured coverage threshold of ${input.coverageThreshold}%.`,
      riskLevel: "medium",
      affectedFiles,
      suggestedTests: affectedFiles.map((path) => `Add tests for ${path} until coverage meets ${input.coverageThreshold}%.`)
    }
  ];
}

export function parseCoverageFinalJson(content: string, repoPath: string): CoverageEntry[] {
  const parsed = JSON.parse(content) as unknown;

  if (!isRecord(parsed)) {
    return [];
  }

  return Object.entries(parsed)
    .map(([path, value]) => {
      const filePath = isRecord(value) && typeof value.path === "string" ? value.path : path;
      const percent = coveragePercentFromJsonEntry(value);

      if (percent === undefined) {
        return undefined;
      }

      return {
        path: normalizeCoveragePath(filePath, repoPath),
        percent
      };
    })
    .filter((entry): entry is CoverageEntry => entry !== undefined);
}

export function parseLcovInfo(content: string, repoPath: string): CoverageEntry[] {
  return content
    .replaceAll("\r\n", "\n")
    .split("\nend_of_record")
    .map((record) => parseLcovRecord(record, repoPath))
    .filter((entry): entry is CoverageEntry => entry !== undefined);
}

async function loadCoverage(input: AnalyzeCoverageInput): Promise<Map<string, number>> {
  const read = input.readFile ?? ((path: string) => readFile(path, "utf8"));
  const entries: CoverageEntry[] = [];

  for (const coverageFile of coverageFiles) {
    try {
      const content = await read(`${input.repoPath}/${coverageFile}`);
      entries.push(...parseCoverageFile(coverageFile, content, input.repoPath));
    } catch {
      continue;
    }
  }

  return entries.reduce((coverage, entry) => {
    coverage.set(entry.path, entry.percent);
    return coverage;
  }, new Map<string, number>());
}

function parseCoverageFile(path: string, content: string, repoPath: string): CoverageEntry[] {
  if (path.endsWith("coverage-final.json")) {
    return parseCoverageFinalJson(content, repoPath);
  }

  return parseLcovInfo(content, repoPath);
}

function coveragePercentFromJsonEntry(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const linesPercent = percentFromSummary(value.lines);

  if (linesPercent !== undefined) {
    return linesPercent;
  }

  if (isRecord(value.l)) {
    return percentFromHitMap(value.l);
  }

  if (isRecord(value.s)) {
    return percentFromHitMap(value.s);
  }

  return undefined;
}

function percentFromSummary(value: unknown): number | undefined {
  if (!isRecord(value) || typeof value.pct !== "number" || !Number.isFinite(value.pct)) {
    return undefined;
  }

  return value.pct;
}

function percentFromHitMap(hitMap: Record<string, unknown>): number | undefined {
  const hits = Object.values(hitMap).filter((value): value is number => typeof value === "number");

  if (hits.length === 0) {
    return undefined;
  }

  const covered = hits.filter((hit) => hit > 0).length;
  return covered / hits.length * 100;
}

function parseLcovRecord(record: string, repoPath: string): CoverageEntry | undefined {
  const lines = record.split("\n");
  const sourceFile = readLcovValue(lines, "SF");
  const lineFound = Number(readLcovValue(lines, "LF"));
  const lineHit = Number(readLcovValue(lines, "LH"));

  if (sourceFile === undefined || !Number.isFinite(lineFound) || !Number.isFinite(lineHit) || lineFound <= 0) {
    return undefined;
  }

  return {
    path: normalizeCoveragePath(sourceFile, repoPath),
    percent: lineHit / lineFound * 100
  };
}

function readLcovValue(lines: string[], key: string): string | undefined {
  const prefix = `${key}:`;
  const line = lines.find((candidate) => candidate.startsWith(prefix));
  return line?.slice(prefix.length).trim();
}

function isProductionCodeFile(file: ChangedFile): boolean {
  return (
    file.status !== "deleted" &&
    (file.category === "source" || file.category === "security") &&
    sourceExtensions.has(extension(file.path)) &&
    !testPathPattern.test(normalizePath(file.path))
  );
}

function extension(path: string): string {
  const match = path.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function normalizeCoveragePath(path: string, repoPath: string): string {
  const repoRelativePath = isAbsolute(path) ? relative(repoPath, path) : path;
  return normalizePath(repoRelativePath);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
