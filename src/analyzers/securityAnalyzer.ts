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
const authMiddlewareHintPattern = /\b(auth|authenticate|authenticated|authorization|authorize|requireAuth|requiresAuth|isAuthenticated|checkAuth|verifyToken|verifyJwt|jwtAuth|passport|protect|permission|canAccess)\b/i;
const secretNamePattern = /\b[A-Za-z0-9_-]*(?:password|passwd|secret|client_secret|private_key|access_token|refresh_token|token|api[_-]?key|apikey|authorization)[A-Za-z0-9_-]*\b/i;
const jwtSecretNamePattern = /\b[A-Za-z0-9_-]*(?:jwt|token)[A-Za-z0-9_-]*(?:secret|key)|(?:secret|key)[A-Za-z0-9_-]*(?:jwt|token)[A-Za-z0-9_-]*\b/i;

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
    matches: (line, context) => hasHardcodedSecret(line, context)
  },
  {
    id: "security-hardcoded-admin-password",
    title: "Possible hardcoded admin password",
    riskLevel: "high",
    recommendation: "Move admin credentials to secure configuration and rotate the password if the value is real.",
    matches: (line, context) => hasHardcodedAdminPassword(line, context)
  },
  {
    id: "security-api-key",
    title: "Possible API key",
    riskLevel: "high",
    recommendation: "Verify whether the key is real. If it is, revoke it and replace it with secret-managed configuration.",
    matches: (line, context) => hasApiKey(line, context)
  },
  {
    id: "security-jwt-secret-default",
    title: "Possible JWT secret fallback",
    riskLevel: "high",
    recommendation: "Require JWT secrets to be provided by secure configuration and fail startup when they are missing.",
    matches: (line, context) => hasJwtSecretDefault(line, context)
  },
  {
    id: "security-env-secret-default",
    title: "Possible secret default in environment config",
    riskLevel: "high",
    recommendation: "Avoid fallback defaults for secret-like environment variables. Fail startup when required secrets are missing.",
    matches: (line, context) => hasSecretEnvDefault(line, context)
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
    id: "security-new-route-missing-auth-middleware",
    title: "Possible missing auth middleware on new route",
    riskLevel: "high",
    recommendation: "Confirm the endpoint is intentionally public or add the expected auth middleware or authorization guard.",
    matches: (line, context) => hasNewRouteWithoutAuthMiddleware(line, context)
  },
  {
    id: "security-disabled-rate-limiting",
    title: "Possible disabled rate limiting",
    riskLevel: "medium",
    recommendation: "Confirm this is not production code. Restore rate limiting or limit bypasses to explicit test-only configuration.",
    matches: (line) => hasDisabledRateLimiting(line)
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

      const confidence = confidenceForSecurityFinding(rule, scannedFile.file, scannedFile.content);

      findings.push({
        id: rule.id,
        area: "security",
        title: rule.title,
        description: descriptionForSecurityFinding(rule, scannedFile.file, confidence),
        riskLevel: riskLevelForRule(rule, scannedFile.file),
        confidence,
        filePath: normalizePath(scannedFile.file.path),
        lineNumber: matchingLineIndex + 1,
        recommendation: rule.recommendation
      });
    }
  }

  return dedupeGeneratedAssetFindings(dedupeSameLineJwtSecretFindings(findings), scannedFiles).sort(compareFindings);
}

async function readChangedTextFiles(input: AnalyzeSecurityInput): Promise<ScannedFile[]> {
  const read = input.readFile ?? ((path: string) => readFile(path, { encoding: "utf8" }));
  const scannedFiles: ScannedFile[] = [];

  for (const file of input.changedFiles) {
    if (file.status === "deleted" || isProjectBrainFile(file) || !isScannablePath(file.path)) {
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

function hasHardcodedSecret(line: string, context: RuleContext): boolean {
  const match = line.match(/\b[A-Za-z0-9_-]*(?:password|passwd|secret|client_secret|private_key|access_token|refresh_token)[A-Za-z0-9_-]*\b\s*[:=]\s*["']([^"']{8,})["']/i);

  if (match === null) {
    return false;
  }

  const value = match[1] ?? "";
  return !isObviousTestFixtureSecret(value, context) && isPotentialRealSecret(value);
}

function hasHardcodedAdminPassword(line: string, context: RuleContext): boolean {
  const match = line.match(/\b(?:admin[A-Za-z0-9_-]*password|password[A-Za-z0-9_-]*admin|ADMIN_PASSWORD|adminPassword)\b\s*[:=]\s*["']([^"']{6,})["']/i);

  if (match !== null) {
    const value = match[1] ?? "";
    return !isObviousTestFixtureSecret(value, context) && isPotentialRealSecret(value);
  }

  const adminObjectMatch = line.match(/\badmin\b[^;\n]{0,80}\bpassword\b\s*[:=]\s*["']([^"']{6,})["']/i);

  if (adminObjectMatch === null) {
    return false;
  }

  const value = adminObjectMatch[1] ?? "";
  return !isObviousTestFixtureSecret(value, context) && isPotentialRealSecret(value);
}

function hasApiKey(line: string, context: RuleContext): boolean {
  if (hasTestFixtureSecretAssignment(line, context)) {
    return false;
  }

  return (
    /\b[A-Za-z0-9_-]*(?:api[_-]?key|apikey)[A-Za-z0-9_-]*\b\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i.test(line) ||
    /\b(?:sk_live|sk_test|pk_live|ghp|github_pat|xoxb|xoxp|AIza)[A-Za-z0-9_\-]{10,}/.test(line) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(line)
  );
}

function hasJwtSecretDefault(line: string, context: RuleContext): boolean {
  const normalized = line.trim();

  if (hasTestFixtureSecretAssignment(normalized, context)) {
    return false;
  }

  return (
    /\b[A-Za-z0-9_.-]*(?:JWT_SECRET|JWT_PRIVATE_KEY|JWT_SIGNING_KEY|jwtSecret|jwtPrivateKey|jwtSigningKey)[A-Za-z0-9_.-]*\b.*(?:\|\||\?\?)\s*["'][^"']{4,}["']/i.test(normalized) ||
    /\b[A-Za-z0-9_.-]*(?:JWT_SECRET|JWT_PRIVATE_KEY|JWT_SIGNING_KEY|jwtSecret|jwtPrivateKey|jwtSigningKey)[A-Za-z0-9_.-]*\b\s*[:=]\s*["'][^"']{4,}["']/i.test(normalized) ||
    (jwtSecretNamePattern.test(normalized) && /(?:\|\||\?\?)\s*["'][^"']{4,}["']/.test(normalized))
  );
}

function hasSecretEnvDefault(line: string, context: RuleContext): boolean {
  const match = line.match(/\bprocess\.env\.([A-Za-z0-9_]+)\b\s*(?:\|\||\?\?)\s*["']([^"']{4,})["']/);

  if (match === null) {
    return false;
  }

  const [, envName = "", defaultValue = ""] = match;
  return secretNamePattern.test(envName) && !isObviousTestFixtureSecret(defaultValue, context) && (isPotentialRealSecret(defaultValue) || isKnownWeakSecretDefault(defaultValue));
}

function isKnownWeakSecretDefault(value: string): boolean {
  return /^(secret|changeme|change-me|default|dev-secret|jwt-secret|password|admin|admin123|test-secret)$/i.test(value.trim());
}

function hasSensitiveConsoleLog(line: string): boolean {
  const match = line.match(/\bconsole\.(?:log|info|warn|error|debug)\s*\((.*)\)\s*;?\s*$/i);

  if (match === null) {
    return false;
  }

  const args = match[1] ?? "";
  const withoutQuotedStrings = args.replace(/(["'])(?:\\.|(?!\1).)*\1/g, "");

  return (
    /\b[A-Za-z0-9_$.-]*(?:token|password|secret|authorizationHeader|authHeader)[A-Za-z0-9_$.-]*\b/i.test(withoutQuotedStrings) ||
    /\bauthorization\b/i.test(withoutQuotedStrings) ||
    /`[^`]*\$\{[^}]*(?:token|password|secret|authorization|authHeader)[^}]*}/i.test(args)
  );
}

function hasCorsWildcard(line: string): boolean {
  return (
    /\bcors\s*\([^)]*\borigin\s*:\s*["']\*["']/i.test(line) ||
    /\borigin\s*:\s*["']\*["']/i.test(line) ||
    /Access-Control-Allow-Origin["']?\s*,\s*["']\*["']/i.test(line)
  );
}

function hasSqlStringInterpolation(line: string): boolean {
  if (!isLikelySqlContext(line)) {
    return false;
  }

  return /`[^`]*\b(?:select|insert|update|delete|merge|upsert)\b[^`]*\$\{[^`]+`/i.test(line) || /["'][^"']*\b(?:select|insert|update|delete|merge|upsert)\b[^"']*["']\s*\+\s*[A-Za-z_$]/i.test(line);
}

function hasDisabledAuthCheck(line: string): boolean {
  return (
    /\b(?:auth|authenticate|authorization|requiredAuth|requireAuth|isAuthenticated|checkAuth)\b\s*:\s*false\b/i.test(line) ||
    /\b(?:skipAuth|disableAuth|authDisabled|bypassAuth)\b\s*[:=]\s*true\b/i.test(line) ||
    /\/\/\s*(?:auth|authentication|authorization)\s+(?:disabled|bypassed|off)/i.test(line)
  );
}

function hasNewRouteWithoutAuthMiddleware(line: string, context: RuleContext): boolean {
  return (
    context.file.status === "added" &&
    !isTestFile(context.file.path) &&
    routeFilePattern.test(normalizePath(context.file.path)) &&
    routeHandlerPattern.test(line) &&
    !authMiddlewareHintPattern.test(context.content)
  );
}

function hasDisabledRateLimiting(line: string): boolean {
  return (
    /\b(?:rateLimit|rateLimiter|limiter|throttle|slowDown)\b\s*:\s*false\b/i.test(line) ||
    /\b(?:disableRateLimit|disableRateLimiting|skipRateLimit|skipRateLimiting|rateLimitDisabled|rateLimitingDisabled|bypassRateLimit)\b\s*[:=]\s*true\b/i.test(line) ||
    /\/\/\s*(?:rate\s*limit|rate\s*limiting|throttling)\s+(?:disabled|bypassed|off)/i.test(line)
  );
}

function riskLevelForRule(rule: SecurityRule, file: ChangedFile): RiskLevel {
  if (isNonRuntimeContextPath(file.path)) {
    return "low";
  }

  return rule.riskLevel;
}

function confidenceForSecurityFinding(rule: SecurityRule, file: ChangedFile, content: string): number {
  let score = 48;

  if (file.category === "security" || isSecuritySensitivePath(file.path)) {
    score += 12;
  }

  if (file.status === "added") {
    score += 6;
  }

  if (isNonRuntimeContextPath(file.path)) {
    score -= 28;
  }

  if (isHighPrecisionSecurityRule(rule.id)) {
    score += 24;
  } else if (isModeratePrecisionSecurityRule(rule.id)) {
    score += 10;
  } else {
    score += 4;
  }

  if (rule.id === "security-new-route-missing-auth-middleware" && routeHandlerPattern.test(content) && !authMiddlewareHintPattern.test(content)) {
    score += 12;
  }

  if (rule.id === "security-new-route-missing-rate-limit" && routeHandlerPattern.test(content) && !rateLimitHintPattern.test(content)) {
    score += 8;
  }

  return clampConfidence(score);
}

function descriptionForSecurityFinding(rule: SecurityRule, file: ChangedFile, confidence: number): string {
  if (confidence < 50) {
    return `${rule.title} may apply in a changed file. This is a low-confidence heuristic signal and not a confirmed vulnerability.`;
  }

  return `${rule.title} detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.`;
}

function isHighPrecisionSecurityRule(ruleId: string): boolean {
  return [
    "security-hardcoded-secret",
    "security-hardcoded-admin-password",
    "security-api-key",
    "security-jwt-secret-default",
    "security-env-secret-default",
    "security-sql-string-interpolation",
    "security-disabled-auth-check"
  ].includes(ruleId);
}

function isModeratePrecisionSecurityRule(ruleId: string): boolean {
  return [
    "security-console-sensitive-value",
    "security-cors-wildcard",
    "security-disabled-rate-limiting",
    "security-new-route-missing-auth-middleware",
    "security-new-route-missing-rate-limit"
  ].includes(ruleId);
}

function isSecuritySensitivePath(path: string): boolean {
  return /(^|\/)(admin|auth|authentication|authorization|crypto|jwt|password|permissions?|roles?|secrets?|security|sessions?|tokens?)(\/|\.|-|_|$)/i.test(normalizePath(path));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isNonRuntimeContextPath(path: string): boolean {
  const normalized = normalizePath(path);

  return (
    isTestFile(normalized) ||
    isGeneratedAssetPath(normalized) ||
    /(^|\/)(__fixtures__|__snapshots__|fixtures?|mocks?|samples?|examples?|snapshots?|templates?)(\/|$)/i.test(normalized) ||
    /(^|\/)(docs?|documentation)(\/|$)/i.test(normalized) ||
    /\.(md|mdx|txt)$/i.test(normalized)
  );
}

function hasNewRouteWithoutRateLimit(line: string, context: RuleContext): boolean {
  return (
    context.file.status === "added" &&
    !isTestFile(context.file.path) &&
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

function hasTestFixtureSecretAssignment(line: string, context: RuleContext): boolean {
  const match = line.match(/\b(?:process\.env\.)?[A-Za-z0-9_-]*(?:password|passwd|secret|client_secret|private_key|access_token|refresh_token|token|api[_-]?key|apikey|authorization)[A-Za-z0-9_-]*\b\s*[:=]\s*["']([^"']{4,})["']/i);

  return match !== null && isObviousTestFixtureSecret(match[1] ?? "", context);
}

function isObviousTestFixtureSecret(value: string, context: RuleContext): boolean {
  if (!isTestFile(context.file.path) || isRealisticLookingSecret(value)) {
    return false;
  }

  return /\b(?:test|fake|mock|dummy|fixture|example|sample|local|dev)\b/i.test(value);
}

function isRealisticLookingSecret(value: string): boolean {
  return (
    /\b(?:sk_live|sk_test|pk_live|ghp|github_pat|xoxb|xoxp|AIza)[A-Za-z0-9_-]{10,}/.test(value) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(value) ||
    (/^[A-Za-z0-9_./+=-]{24,}$/.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value))
  );
}

function isLikelySqlContext(line: string): boolean {
  return (
    /\b(?:query|execute|raw|sql)\s*\(/i.test(line) ||
    /\.\s*(?:query|execute|raw|sql)\s*\(/i.test(line) ||
    /\b(?:sql|query|statement)\b\s*[:=]/i.test(line) ||
    /\b(?:db|pool|client|connection|knex|sequelize|prisma)\b/i.test(line)
  );
}

function dedupeGeneratedAssetFindings(findings: SecurityFinding[], scannedFiles: ScannedFile[]): SecurityFinding[] {
  const sourceFingerprints = new Map<string, Set<string>>();

  for (const scannedFile of scannedFiles) {
    const path = normalizePath(scannedFile.file.path);
    const fingerprint = duplicateContentFingerprint(scannedFile.content);

    if (fingerprint === "" || isGeneratedAssetPath(path)) {
      continue;
    }

    const findingIds = new Set(findings.filter((finding) => finding.filePath === path).map((finding) => finding.id));

    if (findingIds.size > 0) {
      sourceFingerprints.set(fingerprint, findingIds);
    }
  }

  return findings.filter((finding) => {
    const filePath = finding.filePath ?? "";

    if (!isGeneratedAssetPath(filePath)) {
      return true;
    }

    const scannedFile = scannedFiles.find((candidate) => normalizePath(candidate.file.path) === filePath);

    if (scannedFile === undefined) {
      return true;
    }

    return !(sourceFingerprints.get(duplicateContentFingerprint(scannedFile.content))?.has(finding.id) ?? false);
  });
}

function duplicateContentFingerprint(content: string): string {
  return content
    .replace(/\/\/# sourceMappingURL=.*$/gim, "")
    .replace(/\/\*\s*@(?:generated|auto-generated|autogenerated)[\s\S]*?\*\//gi, "")
    .replace(/\/\/\s*(?:generated|auto-generated|autogenerated).*$/gim, "")
    .replace(/\s+/g, "");
}

function isGeneratedAssetPath(path: string): boolean {
  const normalized = normalizePath(path);

  return (
    /(^|\/)(dist|build|out|coverage|generated|gen)(\/|$)/i.test(normalized) ||
    /(^|\/)public\/(?:assets|build|generated|js|scripts)(\/|$)/i.test(normalized) ||
    /(^|\/)public\/[^/]+\.(?:cjs|js|mjs)$/i.test(normalized) ||
    /(?:^|[.-])(?:generated|gen)\.[^.]+$/i.test(normalized)
  );
}

function isScannablePath(path: string): boolean {
  return textFilePattern.test(normalizePath(path));
}

function isTestFile(path: string): boolean {
  return /(^|\/)(__tests__|tests?|spec|cypress|playwright)(\/|$)|(\.|-)(cy|spec|test)\.[^.]+$/i.test(normalizePath(path));
}

function isProjectBrainFile(file: ChangedFile): boolean {
  return file.category === "project-brain" || /(^|\/)\.project-brain(\/|$)/i.test(normalizePath(file.path));
}

function compareFindings(left: SecurityFinding, right: SecurityFinding): number {
  const byFile = (left.filePath ?? "").localeCompare(right.filePath ?? "");

  if (byFile !== 0) {
    return byFile;
  }

  return left.id.localeCompare(right.id);
}

function dedupeSameLineJwtSecretFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const jwtSecretLocations = new Set(
    findings
      .filter((finding) => finding.id === "security-jwt-secret-default")
      .map((finding) => `${finding.filePath ?? ""}:${finding.lineNumber ?? ""}`)
  );

  return findings.filter((finding) => {
    if (finding.id !== "security-hardcoded-secret") {
      return true;
    }

    return !jwtSecretLocations.has(`${finding.filePath ?? ""}:${finding.lineNumber ?? ""}`);
  });
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
