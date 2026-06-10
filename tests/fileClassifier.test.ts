import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyFile } from "../src/repo/fileClassifier.js";
import type { GuardianConfig } from "../src/core/types.js";

const guardianConfig: GuardianConfig = {
  projectName: "AI Restaurants",
  riskFolders: ["src/auth", "src/security"],
  testFolders: ["tests", "cypress"],
  releaseSensitiveFiles: ["package.json", "src/server.ts"],
  requiredChecks: ["npm test"]
};

describe("classifyFile", () => {
  it("classifies AI-Restaurants-like paths", () => {
    assertClassification("src/routes/campaignRoutes.ts", "source", "medium");
    assertClassification("src/db/migrations/001_add_consent.sql", "migration", "high");
    assertClassification("public/restaurant-owner-dashboard.js", "source", "medium");
    assertClassification("cypress/e2e/campaign.cy.ts", "test", "low");
    assertClassification(".github/workflows/deploy.yml", "ci", "high");
    assertClassification(".env.example", "config", "high");
  });

  it("uses Guardian config folders and release-sensitive files", () => {
    assertClassification("src/auth/session.ts", "security", "high");
    assertClassification("src/security/auditLog.ts", "security", "high");
    assertClassification("tests/campaignRoutes.test.ts", "test", "low");
    assertClassification("src/server.ts", "source", "high");
  });

  it("classifies common repository support files", () => {
    assertClassification("README.md", "documentation", "info");
    assertClassification("locales/tr.json", "i18n", "low");
    assertClassification(".github/workflows/test.yml", "ci", "medium");
    assertClassification("assets/logo.png", "unknown", "info");
  });

  it("classifies Project Brain files as informational documentation", () => {
    assertClassification(".project-brain/security-rules.md", "documentation", "info");
    assertClassification(".project-brain/module-map.json", "documentation", "info");
  });
});

function assertClassification(path: string, category: string, riskLevel: string): void {
  const classified = classifyFile(path, guardianConfig);

  assert.equal(classified.category, category);
  assert.equal(classified.riskLevel, riskLevel);
}
