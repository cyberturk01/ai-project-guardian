# Last 20 History Audit

Date: 2026-06-11

Scope: latest 20 local Git commits on the current branch, from `7acc67b` through `631d0c7`.

## Changes Reviewed

| Area | Evidence from history |
| --- | --- |
| Enterprise risk correlation | `7acc67b` added local artifact import and correlation for SARIF, CodeQL, Semgrep, and Snyk. |
| Coverage awareness | `ee5ca83` added coverage parsing and low-coverage changed-code findings. |
| Custom rules | `027a75c` added repository-defined deterministic QA/release rules. |
| PR comment output | `15e91f8` and `be655f6` added compact PR comment rendering without GitHub API calls. |
| SARIF output | `9abeaf8` added SARIF rendering and schema-oriented tests. |
| QA/security accuracy | `e3bed5b` added false-positive audit fixes. |
| Analyzer accuracy baseline | `441bebc` added fixture repositories and integration checks. |
| Project context and metrics docs | `853d2cf` and `58d66f6` added AI context and collection/reporting docs. |
| CLI and scoring polish | `522c180`, `ef2d412`, and `5224f54` updated CLI parsing and risk scoring. |
| Workflow validation | `2ace587` added required-check workflow analysis. |
| Business areas | `5293da4` added configurable business-area support and examples. |
| Baselines | `631d0c7` and `5e6ec63` added accepted finding support and polish. |
| GitHub Actions summaries | `e63c0a8` added summary rendering and CI integration guidance. |
| Security analyzer V2 | `f18c665` expanded practical security heuristics. |

## Gaps Found

- README still described the product as future MVP work instead of current working behavior.
- README usage omitted newer CLI flags: `--format`, `--sarif`, `--codeql`, `--semgrep`, `--snyk`, and `--pr-comment`.
- README did not document JSON/SARIF output modes.
- README did not explain local external scanner artifact import or multi-tool correlation.
- README did not clearly document coverage artifact discovery and `coverageThreshold`.
- README did not mention the analyzer accuracy fixture suite as a maintained measurement baseline.
- README still referenced `.github/workflows/guardian.yml`, although current repository workflows are `.github/workflows/guardian-self-check.yml` and `.github/workflows/test.yml`.

## Updates Made

- Refreshed README positioning from MVP wording to current product capabilities.
- Added complete current CLI flag and environment variable documentation.
- Added examples for full Markdown, SARIF, and external artifact correlation runs.
- Added sections for coverage awareness, external scanner correlation, output modes, and analyzer accuracy baseline.
- Updated the GitHub Actions section to reference the current self-check workflow.

## Still Worth Improving Later

- `docs/github-actions-integration.md` should get a matching refresh for SARIF upload and PR-comment workflows.
- A generated CLI help snapshot test could keep README flag documentation and `--help` output in sync.
- The accuracy report can be expanded with actual precision/recall-style counters once fixtures cover more false-positive and false-negative classes.
