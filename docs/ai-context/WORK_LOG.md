# Work Log

Lightweight RCC memory from completed agent work.

<!-- repo-context-center:work-log:start -->

## 2026-06-24T14:07:20.524Z
- Summary: Calibrated Guardian on four real repos and fixed delegated workflow required-check detection.
- Changed files: `src/analyzers/workflowAnalyzer.ts tests/workflowAnalyzer.test.ts`
- Verification: npm run build; node --test dist/tests/workflowAnalyzer.test.js; Guardian summary/full/json reports for ai-project-guardian, repo-context-center, wallet-health-ui, AI-Restaurants

## 2026-06-24T14:10:00.547Z
- Summary: Completed real-repo calibration; fixed delegated workflow required-check detection and single-tool correlation double-counting.
- Changed files: `src/analyzers/workflowAnalyzer.ts src/core/reportDecisionSupport.ts tests/workflowAnalyzer.test.ts tests/reportDecisionSupport.test.ts docs/ai-context/WORK_LOG...`
- Verification: npm run build; node --test dist/tests/reportDecisionSupport.test.js dist/tests/workflowAnalyzer.test.js; Guardian summary/full/json reports for ai-project-guardian, repo-context-center, wallet-health-ui, AI-Restaurants

## 2026-06-24T14:26:16.487Z
- Summary: Implemented QA blocking semantics calibration: QA review findings no longer inflate blocking counts when related evidence is uncertain; weak test signals and heuristic coverage wording clarified.
- Changed files: `src/analyzers/qaAnalyzer.ts src/core/reportDecisionSupport.ts src/renderers/markdownReport.ts tests/reportDecisionSupport.test.ts tests/qaAnalyzer.test.ts test...`
- Verification: npm run build; npm test; focused reportDecisionSupport/qaAnalyzer/markdownReport tests; real-repo calibration reports in /tmp/guardian-calibration-v018

## 2026-06-24T14:33:32.965Z
- Summary: Implemented fixture-aware secret handling: test and mock fixture secrets stay visible as low, non-blocking findings while production/config/provider-like keys remain protected.
- Changed files: `src/analyzers/securityAnalyzer.ts src/core/reportDecisionSupport.ts src/core/types.ts tests/securityAnalyzer.test.ts tests/reportDecisionSupport.test.ts tests/...`
- Verification: npm run build; node --test dist/tests/securityAnalyzer.test.js dist/tests/reportDecisionSupport.test.js dist/tests/markdownReport.test.js; npm test; AI-Restaurants Guardian JSON spot-check

## 2026-06-24T19:37:27.962Z
- Summary: Implemented domain coverage suggestions with advisory Suggested review rendering for recognized auth, api, cli, workflow, and config path domains.
- Changed files: `auto`
- Verification: npm test

## 2026-06-24T19:41:57.456Z
- Summary: Implemented QA evidence grouping with EvidenceGroup metadata and grouped Markdown rendering while preserving existing QA findings, scoring, and blocking behavior.
- Changed files: `auto`
- Verification: npm test

## 2026-06-24T19:54:30.765Z
- Summary: Merged origin/dev into local dev and verified the merged branch.
- Changed files: `auto`
- Verification: npm test

## 2026-06-24T19:59:29.667Z
- Summary: Prepared v0.2.0 release hardening with output contract tests for Markdown, JSON, SARIF, grouped QA evidence compactness, risk/decision invariance, docs, release notes, and package version update.
- Changed files: `auto`
- Verification: npm test; npm run build; npm pack --dry-run
<!-- repo-context-center:work-log:end -->
