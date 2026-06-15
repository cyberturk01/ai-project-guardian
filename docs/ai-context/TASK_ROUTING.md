# Task Routing

Use this before scanning the repository. Start with the narrowest matching row.

| Task type | Inspect first | Focused verification |
| --- | --- | --- |
| CLI argument parsing | `src/cli/runGuardian.ts`, `tests/cliArgs.test.ts` | `npm run build`, `node --test dist/tests/cliArgs.test.js` |
| Configuration loading/validation | `src/config/loadConfig.ts`, `src/config/guardianConfig.ts`, `tests/config.test.ts` | `npm run build`, `node --test dist/tests/config.test.js` |
| Repository scanning | `src/repo/getChangedFiles.ts`, `src/repo/listRepoFiles.ts`, `src/repo/fileClassifier.ts`, `tests/getChangedFiles.test.ts`, `tests/fileClassifier.test.ts` | `npm run build`, targeted repo test |
| Risk rule evaluation | `src/core/guardian.ts`, `src/analyzers/`, `src/core/baseline.ts`, matching analyzer tests | `npm run build`, targeted analyzer test |
| Report generation | `src/renderers/`, `tests/markdownReport.test.ts`, `tests/prComment.test.ts`, `tests/__snapshots__/guardian-report.md` | `npm run build`, targeted renderer test |
| Test fixtures | `tests/fixtures/`, `tests/__snapshots__/`, related `tests/*.test.ts` | Targeted test that consumes the fixture |
| Context docs / agent workflow | `AGENTS.md`, `docs/ai-context/`; use `.project-brain/metrics/` for routing metrics work | `npm run build`, `npm run lint`, `npm test` when requested |

<!-- repo-context-center:generated:start -->
## Generated Repo Map

### First Files to Open
| Task Area | Open First |
| --- | --- |
| CLI behavior | `src/cli/index.ts`, `src/core/guardian.ts`, `src/config/guardianConfig.ts`, `src/config/loadConfig.ts` |
| Configuration | `src/config/guardianConfig.ts`, `src/config/loadConfig.ts`, `examples/ai-restaurants/guardian.config.json`, `examples/generic-saas/guardian.config.json` |
| Analyzer / risk scoring | `src/analyzers/businessAreaAnalyzer.ts`, `src/analyzers/coverageAnalyzer.ts`, `src/analyzers/customRuleEvaluator.ts`, `src/analyzers/enterpriseRiskCorrelation.ts` |
| Report rendering | `src/renderers/markdownReport.ts`, `src/renderers/markdownSummary.ts`, `src/renderers/prComment.ts`, `src/renderers/renderReport.ts` |
| Repository scanning / classification | `src/repo/fileClassifier.ts`, `src/repo/getChangedFiles.ts`, `src/repo/index.ts`, `src/repo/listRepoFiles.ts` |
| Template / context generation | `templates/project-brain/architecture.md`, `templates/project-brain/deployment-rules.md`, `templates/project-brain/known-bugs.md`, `templates/project-brain/known-risks.md` |
| CI / release workflow | `.github/workflows/guardian-self-check.yml`, `.github/workflows/test.yml`, `src/analyzers/releaseAnalyzer.ts`, `package.json` |
| Tests / fixtures | `tests/actionableGuidance.test.ts`, `tests/analyzerAccuracy.integration.test.ts`, `tests/__snapshots__/guardian-report.md`, `tests/fixtures/project-brain/complete/.project-brain/architecture.md` |

### Task Routing
| Task Type | Start With | Then Check | Tests | Notes |
| --- | --- | --- | --- | --- |
| CLI flags/output | `src/cli/index.ts`, `src/cli/runGuardian.ts` | core command handler, README examples, CLI tests | none detected | Keep output stable for tests and scripts. |
| Config behavior | `examples/ai-restaurants/guardian.config.json`, `examples/generic-saas/guardian.config.json`, `src/config/guardianConfig.ts`, `src/config/loadConfig.ts` | template installer, validator, init tests | `tests/config.test.ts` | Preserve existing user files unless force behavior is explicit. |
| Analyzer/risk rule changes | `src/analyzers/businessAreaAnalyzer.ts`, `src/analyzers/coverageAnalyzer.ts`, `src/analyzers/customRuleEvaluator.ts`, `src/analyzers/enterpriseRiskCorrelation.ts` | validator, hotspots, risk register tests | `tests/businessAreaAnalyzer.test.ts`, `tests/coverageAnalyzer.test.ts`, `tests/customRuleEvaluator.test.ts` | Risk and analyzer wording affects future agent read order. |
| Report rendering | `src/renderers/markdownReport.ts`, `src/renderers/markdownSummary.ts`, `src/renderers/prComment.ts`, `src/renderers/renderReport.ts` | renderers, snapshot-like tests, README examples | `tests/markdownReport.test.ts`, `tests/prComment.test.ts` | Keep generated sections deterministic. |
| Repository scanning/classification | `src/repo/fileClassifier.ts`, `src/repo/getChangedFiles.ts`, `src/repo/index.ts`, `src/repo/listRepoFiles.ts` | context file rules, symbol map output, scan tests | `tests/fileClassifier.test.ts`, `tests/getChangedFiles.test.ts` | Avoid full source reads except bounded symbol extraction. |
| Template/context generation | `templates/project-brain/architecture.md`, `templates/project-brain/deployment-rules.md`, `templates/project-brain/known-bugs.md`, `templates/project-brain/known-risks.md` | template installer, context docs, template tests | none detected | Keep templates compact and aligned with generated context files. |
| Test fixture/snapshot updates | `tests/__snapshots__/guardian-report.md`, `tests/fixtures/project-brain/complete/.project-brain/architecture.md`, `tests/fixtures/project-brain/complete/.project-brain/deployment-rules.md`, `tests/fixtures/project-brain/complete/.project-brain/known-bugs.md` | affected tests, generated docs, do-not-read rules | none detected | Fixture drift can hide broken routing or map output. |
| Auth/access | `src/analyzers/securityAnalyzer.ts`, `templates/project-brain/security-rules.md` | database/session code, risk register, auth tests | `tests/securityAnalyzer.test.ts` | Use Investigation Mode. |
| GitHub Actions / release workflow | `.github/workflows/guardian-self-check.yml`, `.github/workflows/test.yml`, `src/analyzers/releaseAnalyzer.ts`, `templates/project-brain/deployment-rules.md` | package scripts, workflow files, release docs | `tests/releaseAnalyzer.test.ts` | Use Investigation Mode before changing deploy or release behavior. |

_Generated by repo-context-center. Edit outside this section._
<!-- repo-context-center:generated:end -->
