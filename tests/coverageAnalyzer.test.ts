import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeCoverage, parseCoverageFinalJson, parseLcovInfo } from "../src/analyzers/coverageAnalyzer.js";
import type { ChangedFile } from "../src/core/types.js";

describe("parseCoverageFinalJson", () => {
  it("reads Istanbul coverage-final.json file coverage", () => {
    const entries = parseCoverageFinalJson(
      JSON.stringify({
        "/repo/src/menu.ts": {
          path: "/repo/src/menu.ts",
          s: {
            "0": 1,
            "1": 0,
            "2": 1,
            "3": 0
          }
        },
        "src/orders.ts": {
          lines: {
            pct: 92
          }
        }
      }),
      "/repo"
    );

    assert.deepEqual(entries, [
      {
        path: "src/menu.ts",
        percent: 50
      },
      {
        path: "src/orders.ts",
        percent: 92
      }
    ]);
  });
});

describe("parseLcovInfo", () => {
  it("reads lcov.info line coverage", () => {
    const entries = parseLcovInfo(
      [
        "TN:",
        "SF:/repo/src/menu.ts",
        "LF:10",
        "LH:7",
        "end_of_record",
        "TN:",
        "SF:src/orders.ts",
        "LF:4",
        "LH:4",
        "end_of_record"
      ].join("\n"),
      "/repo"
    );

    assert.deepEqual(entries, [
      {
        path: "src/menu.ts",
        percent: 70
      },
      {
        path: "src/orders.ts",
        percent: 100
      }
    ]);
  });
});

describe("analyzeCoverage", () => {
  it("creates a QA finding for changed source files below the configured threshold", async () => {
    const findings = await analyzeCoverage({
      repoPath: "/repo",
      changedFiles: [
        changedFile("src/menu.ts", "source"),
        changedFile("src/orders.ts", "source"),
        changedFile("tests/menu.test.ts", "test")
      ],
      coverageThreshold: 80,
      readFile: async (path) => {
        if (path === "/repo/coverage-final.json") {
          return JSON.stringify({
            "src/menu.ts": {
              s: {
                "0": 1,
                "1": 0
              }
            },
            "src/orders.ts": {
              s: {
                "0": 1,
                "1": 1
              }
            },
            "tests/menu.test.ts": {
              s: {
                "0": 0
              }
            }
          });
        }

        throw new Error("missing");
      }
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "low-coverage-changed-code");
    assert.equal(findings[0].riskLevel, "medium");
    assert.deepEqual(findings[0].affectedFiles, ["src/menu.ts"]);
    assert.match(findings[0].description, /80%/);
  });

  it("uses lcov.info when coverage-final.json is not present", async () => {
    const findings = await analyzeCoverage({
      repoPath: "/repo",
      changedFiles: [changedFile("src/menu.ts", "source")],
      coverageThreshold: 75,
      readFile: async (path) => {
        if (path === "/repo/lcov.info") {
          return ["SF:src/menu.ts", "LF:10", "LH:7", "end_of_record"].join("\n");
        }

        throw new Error("missing");
      }
    });

    assert.deepEqual(findings.map((finding) => finding.id), ["low-coverage-changed-code"]);
    assert.deepEqual(findings[0].affectedFiles, ["src/menu.ts"]);
  });

  it("does nothing when coverage integration files are absent", async () => {
    const findings = await analyzeCoverage({
      repoPath: "/repo",
      changedFiles: [changedFile("src/menu.ts", "source")],
      coverageThreshold: 80,
      readFile: async () => {
        throw new Error("missing");
      }
    });

    assert.deepEqual(findings, []);
  });
});

function changedFile(path: string, category: ChangedFile["category"]): ChangedFile {
  return {
    path,
    status: "modified",
    category,
    riskLevel: category === "source" ? "medium" : "low"
  };
}
