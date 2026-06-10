import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeBusinessAreas, matchesBusinessAreaPath } from "../src/analyzers/businessAreaAnalyzer.js";
import type { ChangedFile, GuardianConfig } from "../src/core/types.js";

const baseConfig: GuardianConfig = {
  projectName: "Business Area Test",
  riskFolders: [],
  testFolders: ["tests"],
  releaseSensitiveFiles: [],
  requiredChecks: [],
  businessAreas: [
    {
      name: "consent",
      description: "Consent, privacy policy, and audit evidence flow",
      riskLevel: "high",
      paths: ["src/consent", "src/privacy", "src/routes/consentRoutes.ts"],
      requiredTestHints: ["consent", "privacy", "audit"],
      requiredBeforeDeploy: [
        "Confirm consent audit evidence is still written",
        "Confirm privacy policy versioning is not broken"
      ]
    }
  ]
};

describe("matchesBusinessAreaPath", () => {
  it("supports exact file path, folder prefix, and substring matching", () => {
    assert.equal(matchesBusinessAreaPath("src/routes/consentRoutes.ts", "src/routes/consentRoutes.ts"), true);
    assert.equal(matchesBusinessAreaPath("src/consent/store.ts", "src/consent"), true);
    assert.equal(matchesBusinessAreaPath("apps/api/src/privacy/audit.ts", "src/privacy"), true);
    assert.equal(matchesBusinessAreaPath("src/menu/menuService.ts", "src/privacy"), false);
  });
});

describe("analyzeBusinessAreas", () => {
  it("creates QA and release findings when a changed consent file has no matching tests", () => {
    const findings = analyzeBusinessAreas({
      changedFiles: [changedFile("src/consent/consentStore.ts")],
      repoFiles: ["src/consent/consentStore.ts"],
      config: baseConfig
    });

    assert.equal(findings.qaFindings.length, 1);
    assert.equal(findings.releaseFindings.length, 1);
    assert.equal(findings.qaFindings[0].title, "Business area changed without matching tests: consent");
    assert.deepEqual(findings.qaFindings[0].affectedFiles, ["src/consent/consentStore.ts"]);
    assert.deepEqual(findings.releaseFindings[0].requiredBeforeDeploy, [
      "Confirm consent audit evidence is still written",
      "Confirm privacy policy versioning is not broken"
    ]);
  });

  it("suppresses the missing-test finding when a matching test hint exists", () => {
    const findings = analyzeBusinessAreas({
      changedFiles: [changedFile("src/privacy/policyVersion.ts")],
      repoFiles: ["tests/consent.audit.test.ts"],
      config: baseConfig
    });

    assert.deepEqual(findings.qaFindings, []);
    assert.equal(findings.releaseFindings.length, 1);
  });

  it("adds requiredBeforeDeploy items to release findings", () => {
    const findings = analyzeBusinessAreas({
      changedFiles: [changedFile("src/routes/consentRoutes.ts")],
      repoFiles: [],
      config: baseConfig
    });

    assert.deepEqual(findings.releaseFindings[0].requiredBeforeDeploy, [
      "Confirm consent audit evidence is still written",
      "Confirm privacy policy versioning is not broken"
    ]);
  });

  it("allows missing businessAreas", () => {
    const findings = analyzeBusinessAreas({
      changedFiles: [changedFile("src/consent/consentStore.ts")],
      repoFiles: [],
      config: {
        projectName: "No Business Areas",
        riskFolders: [],
        testFolders: [],
        releaseSensitiveFiles: [],
        requiredChecks: []
      }
    });

    assert.deepEqual(findings, {
      qaFindings: [],
      releaseFindings: []
    });
  });

  it("does not trigger findings for unrelated files", () => {
    const findings = analyzeBusinessAreas({
      changedFiles: [changedFile("src/menu/menuService.ts")],
      repoFiles: [],
      config: baseConfig
    });

    assert.deepEqual(findings, {
      qaFindings: [],
      releaseFindings: []
    });
  });
});

function changedFile(path: string): ChangedFile {
  return {
    path,
    status: "modified",
    category: "source",
    riskLevel: "medium"
  };
}
