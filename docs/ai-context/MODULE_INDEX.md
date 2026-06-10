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
