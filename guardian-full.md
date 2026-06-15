# AI Project Guardian Report

| Field | Value |
| --- | --- |
| Project | ai-project-guardian |
| Generated | 2026-06-15T21:32:48.996Z |
| Risk score | 40/100 |
| Overall risk | **low** |

## Executive Summary

| Metric | Count |
| --- | ---: |
| Changed files | 58 |
| Blocking findings | 1 |
| Release checklist findings | 2 |
| QA findings | 1 |
| Release findings | 2 |
| Security findings | 10 |
| Workflow findings | 0 |
| External scanner findings | 0 |
| Multi-tool correlations | 0 |
| Accepted findings | 0 |
| Required deploy actions | 6 |
| Actionable guidance items | 16 |

| Decision field | Value |
| --- | --- |
| Merge recommendation | review_required |
| Code risk | **medium** |
| Release checklist risk | **high** |
| Overall/combined risk | **low** |
| Risk reason | 1 blocking finding(s) require review before merge. Code risk: medium. Current overall risk remains low. |

Merge requires review because 1 code/test/security finding(s) need attention before merge.

Highest detected risk: **high**.

## Overall Risk

**low** with score **40/100**.

Low risk detected. Review notes and keep normal release checks in place.

## Score Breakdown

| Component | Value |
| --- | ---: |
| Selected band | workflow |
| Band base | 20 |
| Band max | 40 |
| Band factor | 2 |
| Weighted signal | 228 |
| Changed files | 160 |
| QA findings | 5 |
| Release findings | 13 |
| Security findings | 50 |
| Workflow findings | 0 |
| External scanner findings | 0 |
| Multi-tool correlations | 0 |
| Critical floor applied | No |

## Changed Files

| Status | Path | Category | Risk |
| --- | --- | --- | --- |
| modified | .github/workflows/guardian-self-check.yml | ci | **medium** |
| modified | .gitignore | config | **high** |
| added | .repo-context-center/config.json | unknown | **info** |
| modified | AGENTS.md | documentation | **info** |
| modified | README.md | documentation | **info** |
| added | RELEASE_NOTES.md | documentation | **info** |
| modified | docs/ai-context/CHANGE_LOG.md | project-brain | **info** |
| modified | docs/ai-context/COMMUNICATION_MODE.md | project-brain | **info** |
| added | docs/ai-context/DEPENDENCY_MAP.md | project-brain | **info** |
| added | docs/ai-context/DO_NOT_READ.md | project-brain | **info** |
| added | docs/ai-context/HOTSPOTS.md | project-brain | **info** |
| added | docs/ai-context/LESSONS_LEARNED.md | project-brain | **info** |
| modified | docs/ai-context/MODULE_INDEX.md | project-brain | **info** |
| added | docs/ai-context/PROJECT_MAP.md | project-brain | **info** |
| added | docs/ai-context/RISK_REGISTER.md | project-brain | **info** |
| added | docs/ai-context/SYMBOL_MAP.md | project-brain | **info** |
| modified | docs/ai-context/TASK_ROUTING.md | project-brain | **info** |
| added | docs/ai-context/TOKEN_BUDGET.md | project-brain | **info** |
| modified | docs/github-actions-integration.md | documentation | **info** |
| modified | package-lock.json | config | **high** |
| modified | package.json | config | **high** |
| modified | src/analyzers/qaAnalyzer.ts | source | **medium** |
| modified | src/analyzers/riskScorer.ts | source | **medium** |
| added | src/cli/initGuardian.ts | source | **medium** |
| modified | src/cli/runGuardian.ts | source | **medium** |
| modified | src/config/guardianConfig.ts | source | **medium** |
| modified | src/core/actionableGuidance.ts | source | **medium** |
| modified | src/core/guardian.ts | source | **medium** |
| modified | src/project-brain/loadProjectBrain.ts | source | **medium** |
| added | src/renderers/decisionSummary.ts | source | **medium** |
| modified | src/renderers/markdownReport.ts | source | **medium** |
| modified | src/renderers/markdownSummary.ts | source | **medium** |
| added | src/renderers/onboardingGuidance.ts | source | **medium** |
| modified | src/renderers/prComment.ts | source | **medium** |
| modified | src/repo/getChangedFiles.ts | source | **medium** |
| added | src/repo/ignoredChangedFiles.ts | source | **medium** |
| modified | src/repo/index.ts | source | **medium** |
| modified | tests/__snapshots__/guardian-report.md | generated-report | **info** |
| modified | tests/actionableGuidance.test.ts | test | **low** |
| modified | tests/cliArgs.test.ts | test | **low** |
| added | tests/cliBin.test.ts | test | **low** |
| modified | tests/config.test.ts | test | **low** |
| modified | tests/getChangedFiles.test.ts | test | **low** |
| added | tests/ignoredChangedFiles.test.ts | test | **low** |
| added | tests/initCommand.test.ts | test | **low** |
| modified | tests/markdownReport.test.ts | test | **low** |
| modified | tests/prComment.test.ts | test | **low** |
| modified | tests/projectBrain.test.ts | test | **low** |
| modified | tests/qaAnalyzer.test.ts | test | **low** |
| modified | tests/riskScorer.test.ts | test | **low** |
| modified | tests/runGuardian.integration.test.ts | test | **low** |
| modified | src/analyzers/releaseAnalyzer.ts | source | **medium** |
| modified | src/analyzers/securityAnalyzer.ts | source | **medium** |
| modified | src/core/reportDecisionSupport.ts | source | **medium** |
| modified | tests/releaseAnalyzer.test.ts | test | **low** |
| modified | tests/reportDecisionSupport.test.ts | test | **low** |
| modified | tests/securityAnalyzer.test.ts | test | **low** |
| modified | tests/test-fixtures/analyzer-accuracy/hardcoded-secret/manifest.json | test | **low** |

## Blocking Findings

### QA Findings

### Source changed without nearby test coverage

| Field | Value |
| --- | --- |
| Risk | **medium** |
| Affected files | src/analyzers/qaAnalyzer.ts, src/analyzers/releaseAnalyzer.ts, src/analyzers/riskScorer.ts, src/analyzers/securityAnalyzer.ts, src/cli/initGuardian.ts, src/cli/runGuardian.ts, src/config/guardianConfig.ts, src/core/actionableGuidance.ts, src/core/guardian.ts, src/core/reportDecisionSupport.ts, src/project-brain/loadProjectBrain.ts, src/renderers/decisionSummary.ts, src/renderers/markdownReport.ts, src/renderers/markdownSummary.ts, src/renderers/onboardingGuidance.ts, src/renderers/prComment.ts, src/repo/getChangedFiles.ts, src/repo/ignoredChangedFiles.ts, src/repo/index.ts |

One or more source files changed, but no nearby unit or component test was found in the repository.

**Suggested tests**

- Add or update nearby unit tests for affected source files: src/analyzers/qaAnalyzer.ts, src/analyzers/releaseAnalyzer.ts, src/analyzers/riskScorer.ts, src/analyzers/securityAnalyzer.ts, src/cli/initGuardian.ts, src/cli/runGuardian.ts, src/config/guardianConfig.ts, src/core/actionableGuidance.ts, src/core/guardian.ts, src/core/reportDecisionSupport.ts, src/project-brain/loadProjectBrain.ts, src/renderers/decisionSummary.ts, src/renderers/markdownReport.ts, src/renderers/markdownSummary.ts, src/renderers/onboardingGuidance.ts, src/renderers/prComment.ts, src/repo/getChangedFiles.ts, src/repo/ignoredChangedFiles.ts, src/repo/index.ts.

### Security Findings

### Possible disabled auth check

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/runGuardian.integration.test.ts:709 |

Possible disabled auth check detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Confirm this is not production code. Restore auth checks or guard bypasses behind explicit test-only configuration.

### Possible API key

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:23 |

Possible API key detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Verify whether the key is real. If it is, revoke it and replace it with secret-managed configuration.

### Possible dangerous CORS wildcard

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:26 |

Possible dangerous CORS wildcard detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Restrict CORS origins to the expected client domains and review credential handling.

### Possible disabled auth check

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:34 |

Possible disabled auth check detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Confirm this is not production code. Restore auth checks or guard bypasses behind explicit test-only configuration.

### Possible disabled rate limiting

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:75 |

Possible disabled rate limiting detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Confirm this is not production code. Restore rate limiting or limit bypasses to explicit test-only configuration.

### Possible secret default in environment config

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:24 |

Possible secret default in environment config detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Avoid fallback defaults for secret-like environment variables. Fail startup when required secrets are missing.

### Possible hardcoded admin password

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:72 |

Possible hardcoded admin password detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Move admin credentials to secure configuration and rotate the password if the value is real.

### Possible hardcoded secret

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:22 |

Possible hardcoded secret detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real.

### Possible JWT secret fallback

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:24 |

Possible JWT secret fallback detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Require JWT secrets to be provided by secure configuration and fail startup when they are missing.

### Possible SQL string interpolation

| Field | Value |
| --- | --- |
| Risk | **low** |
| Location | tests/securityAnalyzer.test.ts:33 |

Possible SQL string interpolation detected in a changed file. This is a possible security risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Use parameterized queries or a query builder instead of interpolating values into SQL strings.

### Workflow Findings

No workflow findings.

## Release Checklist

### Package dependency changed

| Field | Value |
| --- | --- |
| Risk | **medium** |
| Affected files | package-lock.json, package.json |

A package manifest or lockfile changed.

**Why it matters:** Dependency updates can alter runtime behavior, build output, transitive packages, and known vulnerability exposure.

**Required before deploy**

- [ ] Run install, build, and test checks from a clean dependency install.
- [ ] Review dependency diff for major upgrades or new runtime packages.
- [ ] Run dependency audit or equivalent security scanning.

### GitHub Actions changed

| Field | Value |
| --- | --- |
| Risk | **high** |
| Affected files | .github/workflows/guardian-self-check.yml |

A GitHub Actions workflow or local action changed.

**Why it matters:** CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.

**Required before deploy**

- [ ] Review workflow triggers, permissions, environments, and secrets usage.
- [ ] Confirm required checks still run before deployment.
- [ ] Validate the workflow on a non-production branch or dry run.

## Enterprise Risk Correlation

No external scanner artifacts imported.

## Accepted Findings

No accepted findings.

## Required Deploy Actions

- [ ] Run install, build, and test checks from a clean dependency install.
- [ ] Review dependency diff for major upgrades or new runtime packages.
- [ ] Run dependency audit or equivalent security scanning.
- [ ] Review workflow triggers, permissions, environments, and secrets usage.
- [ ] Confirm required checks still run before deployment.
- [ ] Validate the workflow on a non-production branch or dry run.

## Actionable Guidance

- [ ] **high** release: Confirm required checks still run before deployment. (.github/workflows/guardian-self-check.yml)
- [ ] **high** release: Review workflow triggers, permissions, environments, and secrets usage. (.github/workflows/guardian-self-check.yml)
- [ ] **high** release: Validate the workflow on a non-production branch or dry run. (.github/workflows/guardian-self-check.yml)
- [ ] **medium** release: Review dependency diff for major upgrades or new runtime packages. (package-lock.json, package.json)
- [ ] **medium** release: Run dependency audit or equivalent security scanning. (package-lock.json, package.json)
- [ ] **medium** release: Run install, build, and test checks from a clean dependency install. (package-lock.json, package.json)
- [ ] **medium** qa: Add or update nearby unit/component tests for touched source files. (src/analyzers/qaAnalyzer.ts, src/analyzers/releaseAnalyzer.ts, src/analyzers/riskScorer.ts, src/analyzers/securityAnalyzer.ts, src/cli/initGuardian.ts, src/cli/runGuardian.ts, src/config/guardianConfig.ts, src/core/actionableGuidance.ts, src/core/guardian.ts, src/core/reportDecisionSupport.ts, src/project-brain/loadProjectBrain.ts, src/renderers/decisionSummary.ts, src/renderers/markdownReport.ts, src/renderers/markdownSummary.ts, src/renderers/onboardingGuidance.ts, src/renderers/prComment.ts, src/repo/getChangedFiles.ts, src/repo/ignoredChangedFiles.ts, src/repo/index.ts)
- [ ] **low** security: Verify whether the key is real. If it is, revoke it and replace it with secret-managed configuration.
- [ ] **low** security: Restrict CORS origins to the expected client domains and review credential handling.
- [ ] **low** security: Confirm this is not production code. Restore auth checks or guard bypasses behind explicit test-only configuration.
- [ ] **low** security: Confirm this is not production code. Restore rate limiting or limit bypasses to explicit test-only configuration.
- [ ] **low** security: Move admin credentials to secure configuration and rotate the password if the value is real.
- [ ] **low** security: Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real.
- [ ] **low** security: Require JWT secrets to be provided by secure configuration and fail startup when they are missing.
- [ ] **low** security: Avoid fallback defaults for secret-like environment variables. Fail startup when required secrets are missing.
- [ ] **low** security: Use parameterized queries or a query builder instead of interpolating values into SQL strings.

## Suggested Tests

- [ ] Add or update nearby unit tests for affected source files: src/analyzers/qaAnalyzer.ts, src/analyzers/releaseAnalyzer.ts, src/analyzers/riskScorer.ts, src/analyzers/securityAnalyzer.ts, src/cli/initGuardian.ts, src/cli/runGuardian.ts, src/config/guardianConfig.ts, src/core/actionableGuidance.ts, src/core/guardian.ts, src/core/reportDecisionSupport.ts, src/project-brain/loadProjectBrain.ts, src/renderers/decisionSummary.ts, src/renderers/markdownReport.ts, src/renderers/markdownSummary.ts, src/renderers/onboardingGuidance.ts, src/renderers/prComment.ts, src/repo/getChangedFiles.ts, src/repo/ignoredChangedFiles.ts, src/repo/index.ts.

## Notes

- This report is generated from repository heuristics and should support, not replace, human review.
- Tip: Run `npx ai-project-guardian init` to generate config, Project Brain templates, and GitHub Actions workflow.
- guardian.config.json was not found; using default config for project "ai-project-guardian".
- Local working tree changes were included in changed-file detection.
- Project Brain context is incomplete; missing files: project.md, architecture.md, testing-strategy.md, deployment-rules.md, security-rules.md, known-risks.md, known-bugs.md, module-map.json.
