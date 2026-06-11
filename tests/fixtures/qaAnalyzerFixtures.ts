import type { ChangedFile, GuardianConfig } from "../../src/core/types.js";
import type { ProjectBrain } from "../../src/project-brain/types.js";

export const guardianConfigFixture: GuardianConfig = {
  projectName: "AI Restaurants",
  riskFolders: ["src/auth", "src/security"],
  testFolders: ["tests", "cypress"],
  releaseSensitiveFiles: ["package.json"],
  requiredChecks: ["npm test"],
  coverageThreshold: 80
};

export const projectBrainFixture: ProjectBrain = {
  rootPath: ".project-brain",
  documents: {
    testingStrategy: {
      fileName: "testing-strategy.md",
      path: ".project-brain/testing-strategy.md",
      content: "Use unit tests, API integration tests, Cypress tests, DB tests, localization tests, and auth negative tests."
    }
  }
};

export const weakCoverageChangedFiles: ChangedFile[] = [
  changedFile("src/services/menuService.ts", "source"),
  changedFile("src/routes/orderRoutes.ts", "source"),
  changedFile("src/components/OrderPanel.tsx", "source"),
  changedFile("src/db/migrations/004_add_orders.sql", "migration"),
  changedFile("locales/en/orders.json", "i18n"),
  changedFile("src/auth/session.ts", "security")
];

export const weakCoverageRepoFiles = [
  "src/services/menuService.ts",
  "src/routes/orderRoutes.ts",
  "src/components/OrderPanel.tsx",
  "src/db/migrations/004_add_orders.sql",
  "locales/en/orders.json",
  "src/auth/session.ts",
  "tests/services/otherService.test.ts",
  "cypress/e2e/login.cy.ts"
];

export const coveredChangedFiles: ChangedFile[] = [
  changedFile("src/services/menuService.ts", "source"),
  changedFile("src/routes/orderRoutes.ts", "source"),
  changedFile("src/components/OrderPanel.tsx", "source"),
  changedFile("src/db/migrations/004_add_orders.sql", "migration"),
  changedFile("locales/en/orders.json", "i18n"),
  changedFile("src/auth/session.ts", "security")
];

export const coveredRepoFiles = [
  "src/services/menuService.ts",
  "tests/src/services/menuService.test.ts",
  "src/routes/orderRoutes.ts",
  "tests/api/orderRoutes.integration.test.ts",
  "src/components/OrderPanel.tsx",
  "cypress/e2e/OrderPanel.cy.ts",
  "src/db/migrations/004_add_orders.sql",
  "tests/db/004_add_orders.integration.test.ts",
  "locales/en/orders.json",
  "tests/i18n/orders.localization.test.ts",
  "src/auth/session.ts",
  "tests/auth/session.unauthorized.test.ts"
];

function changedFile(path: string, category: ChangedFile["category"]): ChangedFile {
  return {
    path,
    status: "modified",
    category,
    riskLevel: category === "source" || category === "i18n" ? "medium" : "high"
  };
}
