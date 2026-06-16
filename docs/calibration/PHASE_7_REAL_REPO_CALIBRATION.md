# Phase 7 Real-Repo Calibration

Generated from local calibration artifacts under `.calibration/`.

## 1. Scope

Phase 7 used the real-repo calibration harness to compare Guardian output against expected risk labels without changing scoring during this reporting step.

Tested or requested repositories:

| Repo | Coverage |
| --- | --- |
| ai-project-guardian | Raw summary and full report available, but the run included local working tree changes. |
| repo-context-center | Clean calibration run available. |
| wallet-health-ui | Requested, but skipped because the local working tree was dirty in the available calibration report. |
| FastAPI | Requested scope item; no local calibration artifact was available. |
| LangChain | Requested scope item; no local calibration artifact was available. |
| AI-Restaurants | Requested if available; no local calibration artifact was available. |

Raw inputs reviewed:

- `.calibration/CALIBRATION_REPORT.md`
- `.calibration/ai-project-guardian/guardian-summary.md`
- `.calibration/ai-project-guardian/guardian-full.md`
- `.calibration/repo-context-center/guardian-summary.md`
- `.calibration/repo-context-center/guardian-full.md`

## 2. Summary Table

| Repo | Expected Risk | Actual Risk | Merge Recommendation | Main Issue | Status |
| ---- | ------------: | ----------: | -------------------- | ---------- | ------ |
| ai-project-guardian | low | low, 40/100 | review_required | One QA blocker from source changes without nearby tests; release checklist items for dependency and workflow changes; low-risk security hits in tests. | Covered with dirty working tree; useful but not final release evidence. |
| repo-context-center | low-medium | low, 34/100 | safe_after_checklist | GitHub Actions workflow changes require checklist review, but no blocking QA/security/workflow findings remain. | Covered with clean working tree. |
| wallet-health-ui | medium | not measured | not measured | Skipped by `--require-clean` because local changes were present. | Needs clean rerun. |
| FastAPI | expected calibration target | not measured | not measured | No local artifact available. | Needs calibration pass. |
| LangChain | expected calibration target | not measured | not measured | No local artifact available. | Needs calibration pass. |
| AI-Restaurants | expected calibration target | not measured | not measured | No local artifact available. | Needs calibration pass if repo is available. |

## 3. Findings

### Preset Detection

- `repo-context-center` resolved project metadata cleanly as `Repo Context Center`.
- `ai-project-guardian` ran with default config because `guardian.config.json` was not present in that repo state. The report also noted incomplete Project Brain context.
- FastAPI and LangChain preset behavior was not validated by available artifacts, so Python and larger monorepo/package preset confidence remains limited.

### Changed-File Filtering

- Generated Guardian reports and Project Brain context were treated as low or info risk where appropriate.
- `repo-context-center` stayed focused on 9 changed files, including CI workflows, Project Brain files, README, and config.
- `ai-project-guardian` reported 60 changed files because local working tree changes were included. That result is useful for stress-testing report readability, but it should not be used as clean release evidence.
- The current calibration report records dirty-repo warnings and skips dirty repos when clean calibration is required.

### QA Guidance

- `repo-context-center` produced 0 QA findings, which is appropriate for a workflow/config/context-heavy change set.
- `ai-project-guardian` produced one medium QA finding for source files without nearby tests. That is a review-required signal, not a hard block in the observed report.
- QA suggestions remain heuristic and should be treated as prompts for reviewer judgment.

### Release Checklist

- `repo-context-center` correctly moved CI workflow changes into `safe_after_checklist`: no code blocker, but required deploy actions remain.
- `ai-project-guardian` surfaced dependency and workflow checklist items, including build/test, dependency audit, workflow trigger, permissions, and dry-run validation tasks.
- This split is the clearest Phase 7 success: checklist-only risk no longer reads like a code merge block.

### Security Findings

- `repo-context-center` produced 0 security findings.
- `ai-project-guardian` surfaced 10 low-risk security findings from test files. The report did not expose private secrets or sensitive values in this Phase 7 summary.
- No available real-repo artifact demonstrates a production high/critical security issue blocking merge, so that remains a required calibration case before broader confidence claims.

### GitHub Actions Readability

- Workflow changes are now easy to read in both summary and full reports.
- `repo-context-center` shows the desired wording: merge is safe after completing release checklist items.
- Required deploy actions are concrete and grouped without forcing the reader through raw workflow file contents.

## 4. Fixes Applied

Implemented calibration and reporting support:

- `scripts/calibrate-real-repos.mjs`: real-repo calibration harness that runs summary and full Guardian reports, writes `.calibration/<repo>/guardian-summary.md`, writes `.calibration/<repo>/guardian-full.md`, and creates `.calibration/CALIBRATION_REPORT.md`.
- `.gitignore`: ignores `.calibration/` so raw generated reports are not committed by default.
- `docs/calibration/PHASE_7_REAL_REPO_CALIBRATION.md`: this release-planning summary.

Previously implemented behavior validated by the available reports:

- `src/renderers/markdownSummary.ts` and `src/renderers/markdownReport.ts`: clearer decision fields, finding counts, actionable guidance, and checklist presentation.
- `src/core/reportDecisionSupport.ts`: separates blocking findings from release checklist findings and produces merge recommendations such as `safe_after_checklist`.
- `src/repo/ignoredChangedFiles.ts` and `src/repo/getChangedFiles.ts`: filters generated/local noise and reports local working tree participation.
- `src/analyzers/securityAnalyzer.ts`: keeps test-file security examples low risk rather than treating them like production secrets.
- `src/analyzers/releaseAnalyzer.ts`: keeps dependency and CI changes visible as release checklist items.

## 5. Before / After Examples

### Over-Alarm Case Reduced

`repo-context-center` changed GitHub Actions workflows and config/context files. Guardian reported:

- Actual risk: low, 34/100
- Merge recommendation: `safe_after_checklist`
- Blocking findings: 0
- Release checklist findings: 1

This is the desired calibrated outcome: CI changes still require review, but they do not look like a source-code security or QA blocker when no blocking finding exists.

### Real Production Risk Still Blocks

The available Phase 7 raw reports do not include a clean production high/critical security or auth-risk repository case. The closest available blocker is `ai-project-guardian`, which produced `review_required` for a medium QA issue and checklist actions, not a production-risk block.

Release confidence therefore depends on one more targeted calibration pass that includes a real production auth/security or migration risk case and confirms Guardian still returns `blocked` when appropriate.

## 6. Remaining Limitations

- Heuristic QA suggestions are still approximate and can over-report when source files do not have nearby tests by naming convention.
- Monorepo detection needs more real-world validation, especially against larger repositories such as LangChain.
- Python/FastAPI calibration still needs broader coverage; no FastAPI artifact was available for this report.
- External scanner integration is still limited in this pass because no SARIF, CodeQL, Semgrep, or Snyk artifacts were imported.
- Dirty working tree handling is improved, but release evidence should come from clean calibration runs.
- `wallet-health-ui`, FastAPI, LangChain, and AI-Restaurants still need clean local runs before the calibration matrix is complete.

## 7. Release Recommendation

**needs one more calibration pass**

Guardian looks close to patch-release ready. The clean `repo-context-center` run validates the most important Phase 7 behavior: checklist-only risk becomes `safe_after_checklist` instead of a merge block. However, the release should wait for one more clean calibration pass that includes:

- `ai-project-guardian` from a clean working tree.
- `wallet-health-ui` from a clean working tree.
- At least one Python/FastAPI repository.
- At least one real production-risk case that should remain `blocked`.

No remaining blocker appears to require a scoring redesign. The blocker is calibration coverage, not implementation readiness.
