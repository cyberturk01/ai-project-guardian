import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChangedFile, RiskLevel, SecurityFinding } from "../core/types.js";

export type AnalyzeSecurityInput = {
  repoPath: string;
  changedFiles: ChangedFile[];
  readFile?: (path: string) => Promise<string>;
};

type SecurityRule = {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  recommendation: string;
  matches: (line: string, context: RuleContext) => boolean;
};

type RuleContext = {
  file: ChangedFile;
  content: string;
};

type ScannedFile = {
  file: ChangedFile;
  content: string;
};

const maxScannedBytes = 1_000_000;
const textFilePattern = /\.(cjs|cts|env|go|js|jsx|json|mjs|mts|php|py|rb|sql|ts|tsx|txt|yaml|yml)$/i;
const routeFilePattern = /(^|\/)(api|apis|routes?|controllers?|handlers?|endpoints?)(\/|$)|(\.|-|_)(route|routes|controller|handler|api)\.[^.]+$/i;
const routeHandlerPattern = /\b(app|router|server)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(/i;
const rateLimitHintPattern = /\b(rateLimit|rateLimiter|limiter|throttle|slowDown|express-rate-limit)\b/i;

const placeholderSecretValues = new Set([
  "changeme",
  "change-me",
  "example",
  "fake",
  "password",
  "secret",
  "test",
  "todo",
  "your-secret",
  "your-secret-here"
]);

const securityRules: SecurityRule[] = [
  {
    id: "security-hardcoded-secret",
    title: "Possible hardcoded secret",
    riskLevel: "high",
    recommendation: "Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real.",
    matches: (line) => hasHardcodedSecret(line)
  },
  {
    id: "security-api-key",
    title: "Possible API key",
    riskLevel: "high",
    recommendation: "Verify whether the key is real. If it is, revoke it and replace it with secret-managed configuration.",
    matches: (line) => hasApiKey(line)
  },
  {
    id: "security-jwt-secret-default",
    title: "Possible JWT secret default",
    riskLevel: "high",
    recommendation: "Require JWT secrets to be provided by secure configuration and fail startup when they are missing.",
    matches: (line) => hasJwtSecretDefault(line)
  },
  {
    id: "security-console-sensitive-value",
    title: "Possible sensitive value logged",
    riskLevel: "medium",
    recommendation: "Remove the log or redact token, password, and secret values before writing application logs.",
    matches: (line) => hasSensitiveConsoleLog(line)
  },
  {
    id: "security-cors-wildcard",
    title: "Possible dangerous CORS wildcard",
    riskLevel: "medium",
    recommendation: "Restrict CORS origins to the expected client domains and review credential handling.",
    matches: (line) => hasCorsWildcard(line)
  },
  {
    id: "security-sql-string-interpolation",
    title: "Possible SQL string interpolation",
    riskLevel: "high",
    recommendation: "Use parameterized queries or a query builder instead of interpolating values into SQL strings.",
    matches: (line) => hasSqlStringInterpolation(line)
  },
  {
    id: "security-disabled-auth-check",
    title: "Possible disabled auth check",
    riskLevel: "high",
    recommendation: "Confirm this is not production code. Restore auth checks or guard bypasses behind explicit test-only configuration.",
    matches: (line) => hasDisabledAuthCheck(line)
  },
  {
    id: "security-new-route-missing-rate-limit",
    title: "Possible missing rate limit on new route",
    riskLevel: "medium",
    recommendation: "Add a route-level or shared rate limit, or document why this endpoint does not need throttling.",
    matches: (line, context) => hasNewRouteWithoutRateLimit(line, context)
  }
];

export async function analyzeSecurity(input: AnalyzeSecurityInput): Promise<SecurityFinding[]> {
  const scannedFiles = await readChangedTextFiles(input);
  const findings: SecurityFinding[] = [];

  for (const scannedFile of scannedFiles) {
    const lines = scannedFile.content.split(/\r?\n/);

    for (const rule of securityRules) {
      const matchingLineIndex = lines.findIndex((line) =>
        rule.matches(line, {
          file: scannedFile.file,
          content: scannedFile.content
        })
      );

      if (matchingLineIndex === -1) {
        continue;
      }

      findings.push({
        id: rule.id,
        area: "security",
        title: rule.title,
        description: `${rule.title} detected in a changed file. This is a possible risk based on heuristic matching, not a confirmed vulnerability.`,
        riskLevel: rule.riskLevel,
        filePath: normalizePath(scannedFile.file.path),
        lineNumber: matchingLineIndex + 1,
        recommendation: rule.recommendation
      });
    }
  }

  return findings.sort(compareFindings);
}

async function readChangedTextFiles(input: AnalyzeSecurityInput): Promise<ScannedFile[]> {
  const read = input.readFile ?? ((path: string) => readFile(path, { encoding: "utf8" }));
  const scannedFiles: ScannedFile[] = [];

  for (const file of input.changedFiles) {
    if (file.status === "deleted" || !isScannablePath(file.path)) {
      continue;
    }

    try {
      const content = await read(join(input.repoPath, file.path));
      scannedFiles.push({
        file,
        content: content.slice(0, maxScannedBytes)
      });
    } catch {
      continue;
    }
  }

  return scannedFiles;
}

function hasHardcodedSecret(line: string): boolean {
  const match = line.match(/\b[A-Za-z0-9_-]*(?:password|passwd|secret|client_secret|private_key|access_token|refresh_token)[A-Za-z0-9_-]*\b\s*[:=]\s*["']([^"']{8,})["']/i);

  if (match === null) {
    return false;
  }

  return isPotentialRealSecret(match[1] ?? "");
}

function hasApiKey(line: string): boolean {
  return (
    /\b[A-Za-z0-9_-]*(?:api[_-]?key|apikey)[A-Za-z0-9_-]*\b\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i.test(line) ||
    /\b(?:sk_live|sk_test|pk_live|ghp|github_pat|xoxb|xoxp|AIza)[A-Za-z0-9_\-]{10,}/.test(line) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(line)
  );
}

function hasJwtSecretDefault(line: string): boolean {
  return (
    /\bJWT_SECRET\b.*(?:\|\||\?\?)\s*["'](?:secret|changeme|change-me|default|dev-secret|jwt-secret)["']/i.test(line) ||
    /\bjwtSecret\b\s*[:=]\s*["'](?:secret|changeme|change-me|default|dev-secret|jwt-secret)["']/i.test(line)
  );
}

function hasSensitiveConsoleLog(line: string): boolean {
  return /\bconsole\.(?:log|info|warn|error|debug)\s*\([^)]*\b(?:token|password|secret)\b[^)]*\)/i.test(line);
}

function hasCorsWildcard(line: string): boolean {
  return (
    /\bcors\s*\([^)]*\borigin\s*:\s*["']\*["']/i.test(line) ||
    /\borigin\s*:\s*["']\*["']/i.test(line) ||
    /Access-Control-Allow-Origin["']?\s*,\s*["']\*["']/i.test(line)
  );
}

function hasSqlStringInterpolation(line: string): boolean {
  return /`[^`]*(?:select|insert|update|delete|where|from)\b[^`]*\$\{[^`]+`/i.test(line);
}

function hasDisabledAuthCheck(line: string): boolean {
  return (
    /\b(?:auth|authenticate|authorization|requiredAuth|requireAuth|isAuthenticated|checkAuth)\b\s*:\s*false\b/i.test(line) ||
    /\b(?:skipAuth|disableAuth|authDisabled|bypassAuth)\b\s*[:=]\s*true\b/i.test(line) ||
    /\/\/\s*(?:auth|authentication|authorization)\s+(?:disabled|bypassed|off)/i.test(line)
  );
}

function hasNewRouteWithoutRateLimit(line: string, context: RuleContext): boolean {
  return (
    context.file.status === "added" &&
    routeFilePattern.test(normalizePath(context.file.path)) &&
    routeHandlerPattern.test(line) &&
    !rateLimitHintPattern.test(context.content)
  );
}

function isPotentialRealSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (placeholderSecretValues.has(normalized)) {
    return false;
  }

  return /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

function isScannablePath(path: string): boolean {
  return textFilePattern.test(normalizePath(path));
}

function compareFindings(left: SecurityFinding, right: SecurityFinding): number {
  const byFile = (left.filePath ?? "").localeCompare(right.filePath ?? "");

  if (byFile !== 0) {
    return byFile;
  }

  return left.id.localeCompare(right.id);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
