# Module Index

Fallback map for missing routing or tasks that span modules.

## CLI

- Purpose: Parse flags, run Guardian, write reports, set exit codes.
- Primary files: `src/cli/index.ts`, `src/cli/runGuardian.ts`.
- Common tasks: Add flags, adjust help text, change CLI output behavior.
- Related tests: `tests/cliArgs.test.ts`, `tests/runGuardian.integration.test.ts`.

## Config

- Purpose: Load environment and `guardian.config.json`, validate Guardian config.
- Primary files: `src/config/loadConfig.ts`, `src/config/guardianConfig.ts`.
- Common tasks: Add config fields, validate defaults, normalize paths.
- Related tests: `tests/config.test.ts`.

## Scanner

- Purpose: Detect changed files, list repository files, classify paths.
- Primary files: `src/repo/getChangedFiles.ts`, `src/repo/listRepoFiles.ts`, `src/repo/fileClassifier.ts`.
- Common tasks: Adjust git detection, path classification, repository file discovery.
- Related tests: `tests/getChangedFiles.test.ts`, `tests/fileClassifier.test.ts`.

## Rules

- Purpose: Produce QA, release, security, workflow, business-area, baseline, and risk findings.
- Primary files: `src/core/guardian.ts`, `src/analyzers/`, `src/core/baseline.ts`.
- Common tasks: Tune findings, add rule inputs, adjust scoring.
- Related tests: `tests/*Analyzer.test.ts`, `tests/riskScorer.test.ts`, `tests/baseline.test.ts`.

## Reports

- Purpose: Render Guardian reports and PR comments.
- Primary files: `src/renderers/`.
- Common tasks: Change Markdown layout, summary output, PR comment text.
- Related tests: `tests/markdownReport.test.ts`, `tests/prComment.test.ts`.

## Tests/Fixtures

- Purpose: Shared fixtures and snapshots for test coverage.
- Primary files: `tests/fixtures/`, `tests/__snapshots__/`, `tests/*.test.ts`.
- Common tasks: Add fixture cases, update snapshots, cover regressions.
- Related tests: The test file that imports the fixture or snapshot.

## Context Docs

- Purpose: Guide future agents before code scanning or behavior changes.
- Primary files: `AGENTS.md`, `docs/ai-context/`.
- Common tasks: Update routing rows, communication guidance, module ownership hints.
- Related tests: Documentation-only changes usually need build/lint/test when requested.

<!-- repo-context-center:generated:start -->
## Generated Repo Map

## CLI
- Purpose: Command parsing and user-facing output.
- Primary files: `src/cli/index.ts`, `src/cli/initGuardian.ts`, `src/cli/runGuardian.ts`.
- Common tasks: add flags, adjust help text, change stdout/stderr, set exit codes.
- Related tests: none detected.
- Dependency hints: src/core/actionableGuidance.ts.
- Risks: exit code regressions, help text drift, stdout/stderr compatibility.

## Configuration
- Purpose: Project configuration and setup rules.
- Primary files: `src/config/guardianConfig.ts`, `src/config/loadConfig.ts`, `examples/ai-restaurants/guardian.config.json`, `examples/generic-saas/guardian.config.json`.
- Common tasks: change defaults, validate config, install templates, update setup rules.
- Related tests: `tests/config.test.ts`.
- Dependency hints: none.
- Risks: default config drift, unsafe overwrite behavior.

## Analyzers / Risk Rules
- Purpose: Analysis, validation, risk scoring, and hotspot guidance.
- Primary files: `src/analyzers/businessAreaAnalyzer.ts`, `src/analyzers/coverageAnalyzer.ts`, `src/analyzers/customRuleEvaluator.ts`, `src/analyzers/enterpriseRiskCorrelation.ts`.
- Common tasks: change analyzers, adjust risk rows, score context quality, validate rules.
- Related tests: `tests/businessAreaAnalyzer.test.ts`, `tests/coverageAnalyzer.test.ts`, `tests/customRuleEvaluator.test.ts`, `tests/enterpriseRiskCorrelation.test.ts`.
- Dependency hints: src/analyzers/businessAreaAnalyzer.ts, tests/*.
- Risks: over-broad warnings, under-reported risky areas.

## Renderers / Reports
- Purpose: Generated CLI reports and markdown output.
- Primary files: `src/renderers/decisionSummary.ts`, `src/renderers/markdownNotes.ts`, `src/renderers/markdownReport.ts`, `src/renderers/markdownSummary.ts`.
- Common tasks: format markdown, format JSON, preserve generated markers, summarize report output.
- Related tests: `tests/markdownReport.test.ts`.
- Dependency hints: src/renderers/decisionSummary.ts, tests/*.
- Risks: broken generated markers, unstable markdown ordering.

## Core / Orchestration
- Purpose: Core coordination and shared command behavior.
- Primary files: `src/core/actionableGuidance.ts`, `src/core/baseline.ts`, `src/core/guardian.ts`, `src/core/reportDecisionSupport.ts`.
- Common tasks: coordinate commands, connect scanner and renderers, share common services.
- Related tests: `tests/actionableGuidance.test.ts`, `tests/baseline.test.ts`, `tests/reportDecisionSupport.test.ts`, `tests/types.test.ts`.
- Dependency hints: src/core/actionableGuidance.ts, tests/*.
- Risks: cross-command regression, shared behavior drift.

## Repository scanning
- Purpose: Repo inspection and lightweight analysis.
- Primary files: `src/repo/fileClassifier.ts`, `src/repo/getChangedFiles.ts`, `src/repo/ignoredChangedFiles.ts`, `src/repo/index.ts`.
- Common tasks: classify files, ignore generated areas, detect symbols, match tests.
- Related tests: `tests/fileClassifier.test.ts`, `tests/getChangedFiles.test.ts`, `tests/ignoredChangedFiles.test.ts`.
- Dependency hints: src/repo/fileClassifier.ts, tests/*.
- Risks: generated files included, real source files missed.

## Templates
- Purpose: Generated templates and starter context content.
- Primary files: `templates/project-brain/architecture.md`, `templates/project-brain/deployment-rules.md`, `templates/project-brain/known-bugs.md`, `templates/project-brain/known-risks.md`.
- Common tasks: update templates, change generated defaults, adjust starter docs.
- Related tests: none detected.
- Dependency hints: docs/ai-context/*, templates/*.
- Risks: stale generated defaults, template/context mismatch.

## Tests / Fixtures
- Purpose: Test data, temp repos, and fixtures.
- Primary files: `tests/__snapshots__/guardian-report.md`, `tests/fixtures/project-brain/complete/.project-brain/architecture.md`, `tests/fixtures/project-brain/complete/.project-brain/deployment-rules.md`, `tests/fixtures/project-brain/complete/.project-brain/known-bugs.md`.
- Common tasks: update temp repo setup, change fixtures, refresh expected docs.
- Related tests: none detected.
- Dependency hints: tests/*.
- Risks: fixture/snapshot drift.

## Auth/access
- Purpose: Authentication, sessions, roles, and permissions.
- Primary files: `src/analyzers/securityAnalyzer.ts`, `templates/project-brain/security-rules.md`.
- Common tasks: auth, access, sessions.
- Related tests: `tests/securityAnalyzer.test.ts`.
- Dependency hints: none.
- Risks: permission bypass, session handling regression.

## Staff/POS/public flows
- Purpose: Public, staff, owner, POS, and QR flows.
- Primary files: `calibration.repos.example.json`, `calibration.repos.local.json`, `scripts/calibrate-real-repos.mjs`.
- Common tasks: public UI, staff workflow, POS.
- Related tests: none detected.
- Dependency hints: none.
- Risks: review real callers before editing.

## Context docs
- Purpose: Agent routing, context maps, and workflow notes.
- Primary files: `AGENTS.md`, `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/MODULE_INDEX.md`, `docs/ai-context/PROJECT_MAP.md`, `.repo-context-center/config.json`.
- Common tasks: update routing, refresh maps, preserve manual notes.
- Related tests: none detected.
- Dependency hints: docs/ai-context/*.
- Risks: future agents misrouted, manual content overwritten.

## Release workflow
- Purpose: CI, deployment, and release configuration.
- Primary files: `.github/workflows/guardian-self-check.yml`, `.github/workflows/test.yml`, `src/analyzers/releaseAnalyzer.ts`, `RELEASE_NOTES.md`.
- Common tasks: CI, deployment, release.
- Related tests: `tests/releaseAnalyzer.test.ts`.
- Dependency hints: .github/workflows/*, package.json.
- Risks: CI blocked, release validation skipped.

_Generated by repo-context-center. Edit outside this section._
<!-- repo-context-center:generated:end -->
