# AI Project Guardian Report

| Field | Value |
| --- | --- |
| Project | AI Restaurants |
| Generated | 2026-06-10T12:00:00.000Z |
| Risk score | 72/100 |
| Overall risk | **high** |

## Executive Summary

| Metric | Count |
| --- | ---: |
| Changed files | 3 |
| Blocking findings | 2 |
| Release checklist findings | 1 |
| QA findings | 1 |
| Release findings | 1 |
| Security findings | 1 |
| Workflow findings | 0 |
| External scanner findings | 0 |
| Multi-tool correlations | 0 |
| Accepted findings | 1 |
| Required deploy actions | 2 |
| Actionable guidance items | 4 |

| Decision field | Value |
| --- | --- |
| Merge recommendation | blocked |
| Code risk | **high** |
| Release checklist risk | **high** |
| Overall/combined risk | **high** |
| Risk reason | Security findings require review. |

Merge blocked because 2 blocking code/test/security finding(s) require attention.

Highest detected risk: **high**.

## Overall Risk

**high** with score **72/100**.

Review required actions before release and confirm owners for unresolved risk.

## Score Breakdown

| Component | Value |
| --- | ---: |
| Selected band | security |
| Band base | 70 |
| Band max | 100 |
| Band factor | 2 |
| Weighted signal | 52 |
| Changed files | 18 |
| QA findings | 8 |
| Release findings | 8 |
| Security findings | 18 |
| Workflow findings | 0 |
| External scanner findings | 0 |
| Multi-tool correlations | 0 |
| Critical floor applied | No |

## Changed Files

| Status | Path | Category | Risk |
| --- | --- | --- | --- |
| modified | src/api/reservations.ts | source | **high** |
| added | tests/reservations.test.ts | test | **low** |
| renamed | .github/workflows/deploy.yml -> .github/workflows/release.yml | ci | **medium** |

## Blocking Findings

### QA Findings

### Route or API changed without API/integration test coverage

| Field | Value |
| --- | --- |
| Risk | **high** |
| Confidence | 84% (high confidence) |
| Affected files | src/api/reservations.ts |

A route, controller, handler, or API file changed without a matching API or integration test.

**Suggested tests**

- Add an API or integration test that exercises src/api/reservations.ts.

### Security Findings

### Possible hardcoded secret

| Field | Value |
| --- | --- |
| Risk | **high** |
| Confidence | 61% (moderate confidence) |
| Location | src/api/reservations.ts:18 |

Possible hardcoded secret detected in a changed file. This is a possible risk based on heuristic matching, not a confirmed vulnerability.

**Recommendation:** Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real.

### Workflow Findings

No workflow findings.

## Release Checklist

### GitHub Actions changed

| Field | Value |
| --- | --- |
| Risk | **high** |
| Affected files | .github/workflows/release.yml |

A GitHub Actions workflow or local action changed.

**Why it matters:** CI/CD workflow changes can skip required checks, alter deployment permissions, or deploy from the wrong trigger.

**Required before deploy**

- [ ] Review workflow triggers, permissions, environments, and secrets usage.
- [ ] Confirm required checks still run before deployment.

## Enterprise Risk Correlation

No external scanner artifacts imported.

## Accepted Findings

These findings matched `.guardian-baseline.json` and are shown for visibility, but they do not contribute to the overall score.

| Type | Title | Risk | Location |
| --- | --- | --- | --- |
| release | GitHub Actions changed | **high** | .github/workflows/release.yml |

## Required Deploy Actions

- [ ] Review workflow triggers, permissions, environments, and secrets usage.
- [ ] Confirm required checks still run before deployment.

## Actionable Guidance

- [ ] **high** release: Confirm required checks still run before deployment. (.github/workflows/release.yml)
- [ ] **high** release: Review workflow triggers, permissions, environments, and secrets usage. (.github/workflows/release.yml)
- [ ] **high** security: Move secrets to a managed secret store or environment variable, then rotate the exposed value if it is real.
- [ ] **high** qa: Add an API or integration test that exercises src/api/reservations.ts. (src/api/reservations.ts)

## Suggested Tests

- [ ] Add an API or integration test that exercises src/api/reservations.ts.

## Notes

- This report is generated from repository heuristics and should support, not replace, human review.
- Tip: Run `npx ai-project-guardian init` to generate config, Project Brain templates, and GitHub Actions workflow.
- guardian.config.json was not found; using default config for project "AI Restaurants".
