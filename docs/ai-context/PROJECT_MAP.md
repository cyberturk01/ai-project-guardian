# Project Map

- Runtime:
- Package manager:
- Build:
- Test:
- Entrypoints:
- Conventions:

<!-- repo-context-center:generated:start -->
## Generated Repo Map

### Main Purpose
Repository risk review for AI-assisted development, QA, release, and security checks.

### Key Directories
- `src/cli` - CLI commands and command entrypoints
- `src/config` - configuration loading and validation
- `src/analyzers` - analysis and rule logic
- `src/renderers` - report rendering and output formatting
- `src/core` - orchestration and core business logic
- `src/repo` - repository scanning and git helpers
- `docs` - documentation
- `templates` - templates/prompts/examples
- `examples` - examples and usage samples
- `tests` - test coverage, fixtures, and regression cases
- `scripts` - automation and maintenance scripts
- `.github/workflows` - CI and release automation
- `docs/ai-context` - generated agent context
- `.repo-context-center` - tool config

### Startup / Entrypoints
- `dist/src/cli/index.js`
- `src/cli/index.ts`

### Repository Understanding Quality
| Signal | Value |
| --- | --- |
| Repo understanding level | High |
| Entrypoints detected | 2 |
| Key directories detected | 14 |
| Modules detected | 7 |
| Dependency hints mode | Conservative |
| Generated/noise filtering | Active (4 ignored/noise areas separated) |

### Main Execution Flow
- CLI starts in `src/cli/index.ts`
- Commands delegate to `src/core/actionableGuidance.ts`, `src/core/baseline.ts`, `src/core/guardian.ts`, `src/core/reportDecisionSupport.ts`
- Behavior is checked by `tests/actionableGuidance.test.ts`, `tests/analyzerAccuracy.integration.test.ts`, `tests/baseline.test.ts`, `tests/businessAreaAnalyzer.test.ts`

### Config
- `src/config/guardianConfig.ts`
- `src/config/loadConfig.ts`
- `examples/ai-restaurants/guardian.config.json`
- `examples/generic-saas/guardian.config.json`
- `examples/togetherly/guardian.config.json`
- `package.json`

### Tests
- `tests/actionableGuidance.test.ts`
- `tests/analyzerAccuracy.integration.test.ts`
- `tests/baseline.test.ts`
- `tests/businessAreaAnalyzer.test.ts`
- `tests/cliArgs.test.ts`
- `tests/cliBin.test.ts`
- `tests/config.test.ts`
- `tests/coverageAnalyzer.test.ts`

### Generated / Ignored Areas
- `__snapshots__/`
- `.next/`
- `.repo-context-center/`
- `build/`
- `coverage/`
- `dist/`
- `docs/ai-context/archive/`
- `fixtures/`
- `node_modules/`
- `package-lock.json/`
- `snapshots/`
- `target/`
- `tests/__snapshots__/`
- `tests/fixtures/`
- `tests/fixtures/project-brain/complete/.project-brain/`
- `tests/fixtures/project-brain/invalid-map/.project-brain/`
- `tests/fixtures/project-brain/partial/.project-brain/`
- `tests/test-fixtures/analyzer-accuracy/`
- `tests/test-fixtures/analyzer-accuracy/auth-change-without-tests/`
- `tests/test-fixtures/analyzer-accuracy/auth-change-without-tests/baseline/`
- `tests/test-fixtures/analyzer-accuracy/auth-change-without-tests/baseline/src/auth/`
- `tests/test-fixtures/analyzer-accuracy/auth-change-without-tests/baseline/tests/`
- `tests/test-fixtures/analyzer-accuracy/auth-change-without-tests/head/src/auth/`
- `tests/test-fixtures/analyzer-accuracy/config-only-change/`
- `tests/test-fixtures/analyzer-accuracy/config-only-change/baseline/`
- `tests/test-fixtures/analyzer-accuracy/config-only-change/baseline/config/`
- `tests/test-fixtures/analyzer-accuracy/config-only-change/head/config/`
- `tests/test-fixtures/analyzer-accuracy/docs-only-change/`
- `tests/test-fixtures/analyzer-accuracy/docs-only-change/baseline/`
- `tests/test-fixtures/analyzer-accuracy/docs-only-change/head/`
- `tests/test-fixtures/analyzer-accuracy/hardcoded-secret/`
- `tests/test-fixtures/analyzer-accuracy/hardcoded-secret/baseline/`
- `tests/test-fixtures/analyzer-accuracy/hardcoded-secret/baseline/tests/`
- `tests/test-fixtures/analyzer-accuracy/hardcoded-secret/head/tests/`
- `tests/test-fixtures/analyzer-accuracy/migration-change-without-db-tests/`
- `tests/test-fixtures/analyzer-accuracy/migration-change-without-db-tests/baseline/`
- `tests/test-fixtures/analyzer-accuracy/migration-change-without-db-tests/baseline/db/migrations/`
- `tests/test-fixtures/analyzer-accuracy/migration-change-without-db-tests/baseline/tests/`
- `tests/test-fixtures/analyzer-accuracy/migration-change-without-db-tests/head/db/migrations/`
- `tests/test-fixtures/analyzer-accuracy/workflow-change/`
- `tests/test-fixtures/analyzer-accuracy/workflow-change/baseline/`
- `tests/test-fixtures/analyzer-accuracy/workflow-change/baseline/.github/workflows/`
- `tests/test-fixtures/analyzer-accuracy/workflow-change/head/.github/workflows/`

### Production-Critical Flows
| Flow | Why critical | First check |
| --- | --- | --- |
| CLI: `src/cli/index.ts`, `src/cli/initGuardian.ts`, `src/cli/runGuardian.ts` | CLI behavior changes can break scripts, help text, JSON output, or exit codes. | npm run build |
| Configuration: `examples/ai-restaurants/guardian.config.json`, `examples/generic-saas/guardian.config.json`, `examples/togetherly/guardian.config.json` | Config mistakes can misroute agent work or break validation. | npm run build |
| Analyzers / Risk Rules: `src/analyzers/businessAreaAnalyzer.ts`, `src/analyzers/coverageAnalyzer.ts`, `src/analyzers/customRuleEvaluator.ts` | Risk guidance affects what agents inspect before changes. | npm run build |
| Renderers / Reports: `src/core/reportDecisionSupport.ts`, `src/renderers/decisionSummary.ts`, `src/renderers/markdownNotes.ts` | Report rendering changes can break generated markdown, JSON consumers, or marker preservation. | npm run build |
| Repository scanning: `src/repo/fileClassifier.ts`, `src/repo/getChangedFiles.ts`, `src/repo/ignoredChangedFiles.ts` | File classification changes can cause future agents to read too much or miss important files. | npm run build |
| Templates: `src/project-brain/index.ts`, `src/project-brain/loadProjectBrain.ts`, `src/project-brain/types.ts` | Template changes can propagate stale or oversized context into new repos. | npm run build |
| Tests / Fixtures: `tests/__snapshots__/guardian-report.md`, `tests/fixtures/project-brain/complete/.project-brain/architecture.md`, `tests/fixtures/project-brain/complete/.project-brain/deployment-rules.md` | Fixture changes can make tests pass while real map output gets worse. | npm run build |
| Auth/access: `src/analyzers/securityAnalyzer.ts`, `templates/project-brain/security-rules.md` | Auth changes can expose accounts or bypass permissions. | npm run build |
| Context docs: `.project-brain/metrics/ANALYZER_ACCURACY_REPORT.md`, `.project-brain/metrics/COLLECTION_GUIDE.md`, `.project-brain/metrics/LAST_20_HISTORY_AUDIT.md` | Context doc changes affect future agent routing and token use. | npm run build |
| Release workflow: `.github/workflows/guardian-self-check.yml`, `.github/workflows/test.yml`, `RELEASE_NOTES.md` | Workflow changes can block releases or deploy broken builds. | npm run build |
| Fixture/snapshot drift: `tests/__snapshots__/guardian-report.md`, `tests/fixtures/project-brain/complete/.project-brain/architecture.md`, `tests/fixtures/project-brain/complete/.project-brain/deployment-rules.md` | Fixtures and expected output can drift from generated map behavior. | npm run build |

_Generated by repo-context-center. Edit outside this section._
<!-- repo-context-center:generated:end -->
