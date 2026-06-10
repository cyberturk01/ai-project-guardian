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
