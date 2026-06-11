import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeEnterpriseRiskCorrelation } from "../src/analyzers/enterpriseRiskCorrelation.js";

describe("analyzeEnterpriseRiskCorrelation", () => {
  it("imports, deduplicates, and correlates local scanner artifacts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "guardian-enterprise-risk-"));
    const codeqlPath = join(dir, "codeql.sarif");
    const semgrepPath = join(dir, "semgrep.json");
    const snykPath = join(dir, "snyk.json");

    await writeFile(
      codeqlPath,
      JSON.stringify({
        version: "2.1.0",
        runs: [
          {
            tool: { driver: { name: "CodeQL" } },
            results: [
              {
                ruleId: "js/hardcoded-credentials",
                level: "error",
                message: { text: "Possible hardcoded secret" },
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: "src/api/reservations.ts" },
                      region: { startLine: 12 }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }),
      "utf8"
    );
    await writeFile(
      semgrepPath,
      JSON.stringify({
        results: [
          {
            check_id: "generic.secrets.security.detected-private-key",
            path: "src/api/reservations.ts",
            start: { line: 12 },
            extra: {
              message: "Possible hardcoded secret",
              severity: "ERROR"
            }
          },
          {
            check_id: "generic.secrets.security.detected-private-key",
            path: "src/api/reservations.ts",
            start: { line: 12 },
            extra: {
              message: "Possible hardcoded secret",
              severity: "ERROR"
            }
          }
        ]
      }),
      "utf8"
    );
    await writeFile(
      snykPath,
      JSON.stringify({
        issues: [
          {
            id: "snyk-code-secret",
            title: "Possible hardcoded secret",
            severity: "high",
            filePath: "src/api/reservations.ts",
            lineNumber: 12
          }
        ]
      }),
      "utf8"
    );

    const result = await analyzeEnterpriseRiskCorrelation({
      artifacts: {
        sarif: [],
        codeql: [codeqlPath],
        semgrep: [semgrepPath],
        snyk: [snykPath]
      },
      securityFindings: [
        {
          id: "security-hardcoded-secret",
          area: "security",
          title: "Possible hardcoded secret",
          description: "Possible hardcoded secret detected in a changed file.",
          riskLevel: "high",
          filePath: "src/api/reservations.ts",
          lineNumber: 12,
          recommendation: "Move the secret."
        }
      ]
    });

    assert.equal(result.externalFindings.length, 3);
    assert.deepEqual(result.importedArtifacts, [codeqlPath, semgrepPath, snykPath]);
    assert.equal(result.warnings.length, 0);

    const multiToolFinding = result.correlatedFindings.find((finding) => finding.confidence === "multi-tool");

    assert.ok(multiToolFinding);
    assert.deepEqual(multiToolFinding.sources, ["codeql", "guardian", "semgrep", "snyk"]);
    assert.equal(multiToolFinding.filePath, "src/api/reservations.ts");
    assert.equal(multiToolFinding.lineNumber, 12);
  });
});
