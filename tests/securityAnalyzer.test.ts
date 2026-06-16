import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { analyzeSecurity } from "../src/analyzers/securityAnalyzer.js";
import type { ChangedFile } from "../src/core/types.js";

const repoPath = "/tmp/security-analyzer-test";

describe("analyzeSecurity", () => {
  it("detects heuristic security risks in changed files only", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("src/config/secrets.ts"),
        changedFile("src/routes/publicRoutes.ts", "added"),
        changedFile("src/db/users.ts"),
        changedFile("src/auth/devAuth.ts"),
        changedFile("src/deleted.ts", "deleted")
      ],
      readFile: fakeReader({
        "src/config/secrets.ts": [
          "const PAYMENT_SECRET = 'safeFakeSecret12345';",
          "const providerApiKey = 'safeFakeApiKey123456789';",
          "const jwtSecret = process.env.JWT_SECRET || 'secret';",
          "console.log('token', token);",
          "app.use(cors({ origin: '*' }));"
        ].join("\n"),
        "src/routes/publicRoutes.ts": [
          "import { Router } from 'express';",
          "const router = Router();",
          "router.post('/signup', signupHandler);"
        ].join("\n"),
        "src/db/users.ts": "const sql = `select * from users where id = ${userId}`;",
        "src/auth/devAuth.ts": "export const authOptions = { requireAuth: false };",
        "src/deleted.ts": "const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';"
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      [
        "security-disabled-auth-check",
        "security-api-key",
        "security-console-sensitive-value",
        "security-cors-wildcard",
        "security-env-secret-default",
        "security-hardcoded-secret",
        "security-jwt-secret-default",
        "security-sql-string-interpolation",
        "security-new-route-missing-auth-middleware",
        "security-new-route-missing-rate-limit"
      ]
    );
    assert.ok(findings.every((finding) => finding.area === "security"));
    assert.ok(findings.every((finding) => /possible security risk/i.test(finding.description)));
    assert.ok(findings.every((finding) => /not a confirmed vulnerability/i.test(finding.description)));
    assert.equal(findings.find((finding) => finding.id === "security-hardcoded-secret")?.lineNumber, 1);
    assert.equal(findings.find((finding) => finding.id === "security-new-route-missing-rate-limit")?.filePath, "src/routes/publicRoutes.ts");
  });

  it("detects Security Analyzer V2 practical risk hints without claiming certainty", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("src/config/security.ts"),
        changedFile("src/routes/adminRoutes.ts", "added"),
        changedFile("src/db/reporting.ts")
      ],
      readFile: fakeReader({
        "src/config/security.ts": [
          "const jwtSecret = process.env.JWT_SECRET || 'localJwtSecret123';",
          "const adminPassword = 'AdminPass12345';",
          "const apiSecret = process.env.PAYMENT_SECRET ?? 'paySecret12345';",
          "console.warn('authorization header', req.headers.authorization);",
          "const config = { cors: { origin: '*' }, disableRateLimit: true };"
        ].join("\n"),
        "src/routes/adminRoutes.ts": [
          "import { Router } from 'express';",
          "const router = Router();",
          "router.get('/admin/users', listUsers);"
        ].join("\n"),
        "src/db/reporting.ts": "const sql = 'select * from users where id = ' + userId;"
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      [
        "security-console-sensitive-value",
        "security-cors-wildcard",
        "security-disabled-rate-limiting",
        "security-env-secret-default",
        "security-hardcoded-admin-password",
        "security-hardcoded-secret",
        "security-jwt-secret-default",
        "security-sql-string-interpolation",
        "security-new-route-missing-auth-middleware",
        "security-new-route-missing-rate-limit"
      ]
    );
    assert.ok(findings.every((finding) => /possible security risk/i.test(finding.description)));
    assert.ok(findings.every((finding) => /not a confirmed vulnerability/i.test(finding.description)));
  });

  it("does not report placeholder secrets, deleted files, or existing routes with rate limits", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("src/config/example.ts"),
        changedFile("src/routes/limitedRoutes.ts", "added"),
        changedFile("src/routes/privateRoutes.ts", "added"),
        changedFile("assets/logo.png")
      ],
      readFile: fakeReader({
        "src/config/example.ts": [
          "const PASSWORD = 'changeme';",
          "const adminPassword = 'changeme';",
          "const JWT_SECRET = process.env.JWT_SECRET;"
        ].join("\n"),
        "src/routes/limitedRoutes.ts": [
          "import { rateLimit } from 'express-rate-limit';",
          "router.get('/status', requireAuth, rateLimit(), statusHandler);"
        ].join("\n"),
        "src/routes/privateRoutes.ts": [
          "import { rateLimit } from 'express-rate-limit';",
          "router.get('/me', requireAuth, rateLimit(), meHandler);"
        ].join("\n"),
        "assets/logo.png": "not scanned"
      })
    });

    assert.deepEqual(findings, []);
  });

  it("only flags console logs when a sensitive expression is logged", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("src/auth/csrf.ts")],
      readFile: fakeReader({
        "src/auth/csrf.ts": [
          "console.warn('CSRF token unavailable');",
          "console.warn('authorization header', req.headers.authorization);"
        ].join("\n")
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      ["security-console-sensitive-value"]
    );
    assert.equal(findings[0]?.lineNumber, 2);
  });

  it("does not flag static console messages containing sensitive words", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("src/auth/csrf.ts")],
      readFile: fakeReader({
        "src/auth/csrf.ts": "console.warn('CSRF token unavailable');"
      })
    });

    assert.deepEqual(findings, []);
  });

  it("only flags SQL interpolation in likely query contexts", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("src/email/reservationEmail.ts"),
        changedFile("src/db/reservations.ts")
      ],
      readFile: fakeReader({
        "src/email/reservationEmail.ts": "const body = `Your reservation changed from ${oldTime} to ${newTime}`;",
        "src/db/reservations.ts": "await db.query(`select * from reservations where id = ${reservationId}`);"
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      ["security-sql-string-interpolation"]
    );
    assert.equal(findings[0]?.filePath, "src/db/reservations.ts");
  });

  it("suppresses obvious test fixture secrets while keeping realistic-looking test secrets", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("tests/envFixture.test.ts"),
        changedFile("tests/realisticSecret.test.ts")
      ],
      readFile: fakeReader({
        "tests/envFixture.test.ts": [
          "process.env.JWT_SECRET = 'test-secret-key-12345';",
          "process.env.INTERNAL_API_KEY = 'test-internal-key';"
        ].join("\n"),
        "tests/realisticSecret.test.ts": "process.env.INTERNAL_API_KEY = 'A1b2C3d4E5f6G7h8I9j0K1l2';"
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      ["security-api-key"]
    );
    assert.equal(findings[0]?.filePath, "tests/realisticSecret.test.ts");
    assert.equal(findings[0]?.riskLevel, "low");
  });

  it("deduplicates hardcoded-secret when jwt-secret-default triggers on the same line", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("src/auth/jwt.ts")],
      readFile: fakeReader({
        "src/auth/jwt.ts": "const jwtSecret = 'RealJwtSecret12345';"
      })
    });

    assert.deepEqual(
      findings.map((finding) => finding.id),
      ["security-jwt-secret-default"]
    );
  });

  it("deduplicates generated asset findings when source content is effectively identical", async () => {
    const duplicateContent = [
      "// generated from src/templates/secretSnippet.ts",
      "const PAYMENT_SECRET = 'RealSecret12345';"
    ].join("\n");
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("src/templates/secretSnippet.ts"),
        changedFile("public/secretSnippet.js")
      ],
      readFile: fakeReader({
        "src/templates/secretSnippet.ts": "const PAYMENT_SECRET = 'RealSecret12345';",
        "public/secretSnippet.js": duplicateContent
      })
    });

    assert.deepEqual(
      findings.map((finding) => `${finding.id}:${finding.filePath}`),
      ["security-hardcoded-secret:src/templates/secretSnippet.ts"]
    );
  });

  it("keeps generated asset findings when no source duplicate exists", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("public/checkout.js")],
      readFile: fakeReader({
        "public/checkout.js": "const PAYMENT_SECRET = 'RealSecret12345';"
      })
    });

    assert.deepEqual(
      findings.map((finding) => `${finding.id}:${finding.filePath}`),
      ["security-hardcoded-secret:public/checkout.js"]
    );
  });

  it("ignores unreadable changed files", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("src/missing.ts")],
      readFile: async () => {
        throw new Error("missing");
      }
    });

    assert.deepEqual(findings, []);
  });

  it("does not scan Project Brain security rules for security findings", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        {
          path: ".project-brain/security-rules.md",
          status: "modified",
          category: "project-brain",
          riskLevel: "info"
        }
      ],
      readFile: fakeReader({
        ".project-brain/security-rules.md": [
          "Document examples like apiKey = 'safeFakeApiKey123456789' are context only.",
          "const PAYMENT_SECRET = 'safeFakeSecret12345';",
          "router.post('/signup', signupHandler);"
        ].join("\n")
      })
    });

    assert.deepEqual(findings, []);
  });

  it("does not flag route middleware findings from added test files", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("tests/routes/publicRoutes.test.ts", "added")],
      readFile: fakeReader({
        "tests/routes/publicRoutes.test.ts": [
          "import { Router } from 'express';",
          "const router = Router();",
          "router.get('/fixture-public-route', fixtureHandler);"
        ].join("\n")
      })
    });

    assert.deepEqual(findings, []);
  });

  it("downgrades disabled auth bypass findings in test and fixture files", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("tests/auth/bypass.test.ts"),
        changedFile("fixtures/auth/sampleBypass.ts")
      ],
      readFile: fakeReader({
        "tests/auth/bypass.test.ts": "export const options = { requireAuth: false };",
        "fixtures/auth/sampleBypass.ts": "export const options = { bypassAuth: true };"
      })
    });

    assert.deepEqual(
      findings.map((finding) => `${finding.id}:${finding.riskLevel}:${finding.filePath}`),
      [
        "security-disabled-auth-check:low:fixtures/auth/sampleBypass.ts",
        "security-disabled-auth-check:low:tests/auth/bypass.test.ts"
      ]
    );
  });

  it("downgrades heuristic findings in template and snapshot files", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [
        changedFile("templates/auth/sample.ts"),
        changedFile("src/__snapshots__/authSnapshot.ts")
      ],
      readFile: fakeReader({
        "templates/auth/sample.ts": "export const options = { requireAuth: false };",
        "src/__snapshots__/authSnapshot.ts": "const jwtSecret = 'RealJwtSecret12345';"
      })
    });

    assert.deepEqual(
      findings.map((finding) => `${finding.id}:${finding.riskLevel}:${finding.filePath}`),
      [
        "security-jwt-secret-default:low:src/__snapshots__/authSnapshot.ts",
        "security-disabled-auth-check:low:templates/auth/sample.ts"
      ]
    );
  });

  it("keeps disabled auth bypass findings high in production source files", async () => {
    const findings = await analyzeSecurity({
      repoPath,
      changedFiles: [changedFile("src/auth/devAuth.ts")],
      readFile: fakeReader({
        "src/auth/devAuth.ts": "export const options = { requireAuth: false };"
      })
    });

    assert.deepEqual(
      findings.map((finding) => `${finding.id}:${finding.riskLevel}:${finding.filePath}`),
      ["security-disabled-auth-check:high:src/auth/devAuth.ts"]
    );
  });
});

function changedFile(path: string, status: ChangedFile["status"] = "modified"): ChangedFile {
  return {
    path,
    status,
    category: "source",
    riskLevel: "medium"
  };
}

function fakeReader(files: Record<string, string>): (path: string) => Promise<string> {
  return async (path: string) => {
    const relativePath = path.replace(`${repoPath}/`, "");
    const content = files[relativePath] ?? files[path.replace(join(repoPath, ""), "")];

    if (content === undefined) {
      throw new Error(`No fake content for ${path}`);
    }

    return content;
  };
}
