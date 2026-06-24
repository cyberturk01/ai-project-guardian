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
<!-- repo-context-center:work-log:end -->
