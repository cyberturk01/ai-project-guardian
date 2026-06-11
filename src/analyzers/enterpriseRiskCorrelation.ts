import { readFile } from "node:fs/promises";
import type { ExternalArtifactConfig } from "../config/loadConfig.js";
import type {
  CorrelatedFinding,
  EnterpriseRiskCorrelation,
  ExternalFinding,
  ExternalScanner,
  RiskLevel,
  SecurityFinding
} from "../core/types.js";

export type AnalyzeEnterpriseRiskCorrelationInput = {
  artifacts: ExternalArtifactConfig;
  securityFindings: SecurityFinding[];
};

type ArtifactInput = {
  source: ExternalScanner;
  path: string;
};

type SarifLog = {
  runs?: Array<{
    tool?: {
      driver?: {
        name?: string;
      };
    };
    results?: Array<{
      ruleId?: string;
      level?: string;
      message?: {
        text?: string;
      };
      locations?: Array<{
        physicalLocation?: {
          artifactLocation?: {
            uri?: string;
          };
          region?: {
            startLine?: number;
          };
        };
      }>;
      properties?: {
        "security-severity"?: string;
        securitySeverity?: string;
      };
    }>;
  }>;
};

type SemgrepJson = {
  results?: Array<{
    check_id?: string;
    path?: string;
    start?: {
      line?: number;
    };
    extra?: {
      message?: string;
      severity?: string;
    };
  }>;
};

type SnykJson = {
  vulnerabilities?: Array<{
    id?: string;
    title?: string;
    severity?: string;
    packageName?: string;
    from?: string[];
  }>;
  issues?: Array<{
    id?: string;
    title?: string;
    severity?: string;
    filePath?: string;
    lineNumber?: number;
  }>;
};

export async function analyzeEnterpriseRiskCorrelation(
  input: AnalyzeEnterpriseRiskCorrelationInput
): Promise<EnterpriseRiskCorrelation> {
  const artifactInputs = artifactInputsFromConfig(input.artifacts);
  const imported: ExternalFinding[] = [];
  const warnings: string[] = [];

  for (const artifact of artifactInputs) {
    try {
      const parsed = JSON.parse(await readFile(artifact.path, "utf8")) as unknown;
      imported.push(...parseArtifact(parsed, artifact));
    } catch {
      warnings.push(`External scanner artifact could not be imported: ${artifact.path}`);
    }
  }

  const externalFindings = dedupeExternalFindings(imported);
  const correlatedFindings = correlateFindings(externalFindings, input.securityFindings);

  return {
    externalFindings,
    correlatedFindings,
    importedArtifacts: artifactInputs.map((artifact) => artifact.path),
    warnings
  };
}

function artifactInputsFromConfig(artifacts: ExternalArtifactConfig): ArtifactInput[] {
  return [
    ...artifacts.sarif.map((path) => ({ source: "sarif" as const, path })),
    ...artifacts.codeql.map((path) => ({ source: "codeql" as const, path })),
    ...artifacts.semgrep.map((path) => ({ source: "semgrep" as const, path })),
    ...artifacts.snyk.map((path) => ({ source: "snyk" as const, path }))
  ];
}

function parseArtifact(value: unknown, artifact: ArtifactInput): ExternalFinding[] {
  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray((value as SarifLog).runs)) {
    return parseSarif(value as SarifLog, artifact);
  }

  if (artifact.source === "semgrep") {
    return parseSemgrep(value as SemgrepJson, artifact);
  }

  if (artifact.source === "snyk") {
    return parseSnyk(value as SnykJson, artifact);
  }

  return [];
}

function parseSarif(sarif: SarifLog, artifact: ArtifactInput): ExternalFinding[] {
  const findings: ExternalFinding[] = [];

  for (const run of sarif.runs ?? []) {
    const toolName = run.tool?.driver?.name ?? artifact.source;

    for (const result of run.results ?? []) {
      const location = result.locations?.[0]?.physicalLocation;
      const ruleId = result.ruleId ?? "unknown-rule";
      const title = result.message?.text ?? ruleId;
      const severity = result.properties?.securitySeverity ?? result.properties?.["security-severity"];

      findings.push({
        id: externalFindingId(artifact.source, ruleId, location?.artifactLocation?.uri, location?.region?.startLine, title),
        source: normalizeSourceName(artifact.source, toolName),
        ruleId,
        title,
        description: title,
        riskLevel: riskFromSarif(result.level, severity),
        filePath: normalizePath(location?.artifactLocation?.uri),
        lineNumber: location?.region?.startLine,
        artifactPath: artifact.path
      });
    }
  }

  return findings;
}

function parseSemgrep(semgrep: SemgrepJson, artifact: ArtifactInput): ExternalFinding[] {
  return (semgrep.results ?? []).map((result) => {
    const ruleId = result.check_id ?? "semgrep-rule";
    const title = result.extra?.message ?? ruleId;

    return {
      id: externalFindingId("semgrep", ruleId, result.path, result.start?.line, title),
      source: "semgrep",
      ruleId,
      title,
      description: title,
      riskLevel: riskFromSemgrepSeverity(result.extra?.severity),
      filePath: normalizePath(result.path),
      lineNumber: result.start?.line,
      artifactPath: artifact.path
    };
  });
}

function parseSnyk(snyk: SnykJson, artifact: ArtifactInput): ExternalFinding[] {
  const vulnerabilityFindings = (snyk.vulnerabilities ?? []).map((vulnerability) => {
    const ruleId = vulnerability.id ?? vulnerability.packageName ?? "snyk-vulnerability";
    const title = vulnerability.title ?? ruleId;

    return {
      id: externalFindingId("snyk", ruleId, vulnerability.packageName, undefined, title),
      source: "snyk",
      ruleId,
      title,
      description: title,
      riskLevel: riskFromNamedSeverity(vulnerability.severity),
      filePath: undefined,
      lineNumber: undefined,
      artifactPath: artifact.path
    };
  });
  const issueFindings = (snyk.issues ?? []).map((issue) => {
    const ruleId = issue.id ?? "snyk-issue";
    const title = issue.title ?? ruleId;

    return {
      id: externalFindingId("snyk", ruleId, issue.filePath, issue.lineNumber, title),
      source: "snyk",
      ruleId,
      title,
      description: title,
      riskLevel: riskFromNamedSeverity(issue.severity),
      filePath: normalizePath(issue.filePath),
      lineNumber: issue.lineNumber,
      artifactPath: artifact.path
    };
  });

  return [...vulnerabilityFindings, ...issueFindings];
}

function dedupeExternalFindings(findings: ExternalFinding[]): ExternalFinding[] {
  const byFingerprint = new Map<string, ExternalFinding>();

  for (const finding of findings) {
    const fingerprint = [
      finding.source.toLowerCase(),
      finding.ruleId.toLowerCase(),
      finding.filePath ?? "",
      finding.lineNumber ?? "",
      normalizeTitle(finding.title)
    ].join("|");

    if (!byFingerprint.has(fingerprint)) {
      byFingerprint.set(fingerprint, finding);
    }
  }

  return [...byFingerprint.values()].sort(compareExternalFindings);
}

function correlateFindings(externalFindings: ExternalFinding[], securityFindings: SecurityFinding[]): CorrelatedFinding[] {
  const groups = new Map<string, Array<ExternalFinding | SecurityFinding>>();

  for (const finding of externalFindings) {
    pushGroup(groups, correlationKey(finding.filePath, finding.lineNumber, finding.title), finding);
  }

  for (const finding of securityFindings) {
    pushGroup(groups, correlationKey(finding.filePath, finding.lineNumber, finding.title), finding);
  }

  return [...groups.values()]
    .map(toCorrelatedFinding)
    .sort((left, right) => {
      if (left.confidence !== right.confidence) {
        return left.confidence === "multi-tool" ? -1 : 1;
      }

      return (left.filePath ?? "").localeCompare(right.filePath ?? "") || left.title.localeCompare(right.title);
    });
}

function toCorrelatedFinding(findings: Array<ExternalFinding | SecurityFinding>): CorrelatedFinding {
  const first = findings[0];
  const sources = uniqueSorted(findings.map(sourceName));
  const riskLevel = highestRiskLevel(findings.map((finding) => finding.riskLevel));

  return {
    id: `correlated-${stableSlug([first.filePath ?? "", String(first.lineNumber ?? ""), first.title].join("-"))}`,
    title: first.title,
    riskLevel,
    filePath: first.filePath,
    lineNumber: first.lineNumber,
    sources,
    findingIds: findings.map((finding) => finding.id).sort((left, right) => left.localeCompare(right)),
    confidence: sources.length > 1 ? "multi-tool" : "single-tool"
  };
}

function pushGroup(groups: Map<string, Array<ExternalFinding | SecurityFinding>>, key: string, finding: ExternalFinding | SecurityFinding): void {
  const existing = groups.get(key) ?? [];
  existing.push(finding);
  groups.set(key, existing);
}

function correlationKey(filePath: string | undefined, lineNumber: number | undefined, title: string): string {
  return [filePath ?? "repository", lineNumber ?? "", normalizeTitle(title)].join("|");
}

function sourceName(finding: ExternalFinding | SecurityFinding): string {
  return "source" in finding ? finding.source : "guardian";
}

function riskFromSarif(level: string | undefined, securitySeverity: string | undefined): RiskLevel {
  const numericSeverity = securitySeverity === undefined ? Number.NaN : Number(securitySeverity);

  if (Number.isFinite(numericSeverity)) {
    if (numericSeverity >= 9) {
      return "critical";
    }

    if (numericSeverity >= 7) {
      return "high";
    }

    if (numericSeverity >= 4) {
      return "medium";
    }

    if (numericSeverity > 0) {
      return "low";
    }
  }

  if (level === "error") {
    return "high";
  }

  if (level === "warning") {
    return "medium";
  }

  return "low";
}

function riskFromSemgrepSeverity(severity: string | undefined): RiskLevel {
  if (severity === "ERROR") {
    return "high";
  }

  if (severity === "WARNING") {
    return "medium";
  }

  return "low";
}

function riskFromNamedSeverity(severity: string | undefined): RiskLevel {
  const normalized = severity?.toLowerCase();

  if (normalized === "critical") {
    return "critical";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "medium" || normalized === "moderate") {
    return "medium";
  }

  if (normalized === "low") {
    return "low";
  }

  return "info";
}

function highestRiskLevel(levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["info", "low", "medium", "high", "critical"];

  return levels.reduce((highest, level) => (order.indexOf(level) > order.indexOf(highest) ? level : highest), "info");
}

function normalizeSourceName(source: ExternalScanner, toolName: string): string {
  if (source !== "sarif") {
    return source;
  }

  const normalizedToolName = toolName.toLowerCase();

  if (normalizedToolName.includes("codeql")) {
    return "codeql";
  }

  if (normalizedToolName.includes("semgrep")) {
    return "semgrep";
  }

  if (normalizedToolName.includes("snyk")) {
    return "snyk";
  }

  return "sarif";
}

function compareExternalFindings(left: ExternalFinding, right: ExternalFinding): number {
  return (
    (left.filePath ?? "").localeCompare(right.filePath ?? "") ||
    (left.lineNumber ?? 0) - (right.lineNumber ?? 0) ||
    left.source.localeCompare(right.source) ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function externalFindingId(source: string, ruleId: string, filePath: string | undefined, lineNumber: number | undefined, title: string): string {
  return `${source}-${stableSlug([ruleId, filePath ?? "", String(lineNumber ?? ""), title].join("-"))}`;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stableSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "finding";
}

function normalizePath(path: string | undefined): string | undefined {
  if (path === undefined || path.trim() === "") {
    return undefined;
  }

  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
