# v0.1.x Final Calibration Closure

Generated from the 2026-06-24 closure pass.

## Scope

This closure pass made no analyzer or scoring-system additions. It focused on:

- signal-based QA wording
- report grouping by decision impact
- regenerated real-repo calibration artifacts
- verification that advisory/review-only evidence does not render as blocking

## Code Closure Evidence

| Goal | PASS | Evidence |
| ---- | ---- | -------- |
| Replace guaranteed missing-coverage wording | PASS | QA titles/descriptions now use test-signal wording such as "without nearby test signal" and "without clear API/integration test signal". A repository search found no remaining source/report wording that claims guaranteed absent coverage, leaked secrets, exposed production secrets, or detected vulnerabilities outside negative test assertions. |
| Separate report sections | PASS | Full Markdown reports now render separate `Blocking Findings`, `Review Findings`, and `Advisory Findings` sections. Review-only QA findings are no longer rendered under blocking findings. |
| Keep broad QA advisory/review-only | PASS | `qa-source-without-nearby-test` appears under `Review Findings` in `.calibration/ai-project-guardian/guardian-full.md`, while `Blocking findings` is `0`. |
| Keep weak related tests non-blocking | PASS | AI-Restaurants weak related test signals appear under `Review Findings`; the auth/security QA finding says related signal is weak and asks for review rather than blocking on that evidence. |
| Keep fixture secrets non-blocking | PASS | AI-Restaurants and ai-project-guardian fixture-like secret findings appear under `Advisory Findings` with "Possible test fixture secret detected" wording and are not treated as confirmed production leaks. |
| Preserve advisory policy | PASS | Release findings remain checklist items; low/medium heuristic security findings remain non-blocking; review-only QA findings produce `review_required` instead of `blocked`. |
| Tests | PASS | `npm test` passed: 278 tests, 37 suites, 0 failures. |

## Regenerated Calibration Artifacts

Artifacts were regenerated under `.calibration/` using:

```sh
node scripts/calibrate-real-repos.mjs --config calibration.closure.repos.json --out .calibration
```

| Repo | Changed files | Blocking findings | Merge recommendation | Calibration value |
| ---- | ------------: | ----------------: | -------------------- | ----------------- |
| ai-project-guardian | 71 | 0 | `review_required` | Valid closure evidence for wording/grouping; working tree was dirty because this closure pass was in progress. |
| repo-context-center | 109 | 0 | `review_required` | Useful real-repo evidence that QA findings are review-only, not blockers. |
| wallet-health-ui | 1 | 0 | `review_required` | Complete UI-focused evidence from a temporary calibration copy: `src/app/page.tsx` changed from starter content to a wallet health dashboard rendering. The source repo had no test framework, so no related test change was available. |
| AI-Restaurants | 31 | 1 | `blocked` | Useful real-repo evidence for true blocking security findings, weak related QA review findings, and advisory fixture secrets. |
| fastapi | 13 | 0 | `safe` | Optional evidence only; dirty files were context/report artifacts, not a meaningful FastAPI code change. |
| langchain | 14 | 0 | `safe` | Optional monorepo evidence only; dirty files were context/report artifacts, not a meaningful monorepo code change. |

## Closure Checks

| Check | PASS | Evidence |
| ----- | ---- | -------- |
| `qa-source-without-nearby-test` is not blocking | PASS | ai-project-guardian report: `Blocking findings` is `0`; the source test-signal finding is under `Review Findings`. |
| Weak related tests are not blocking | PASS | AI-Restaurants report lists weak related tests and review wording under `Review Findings`; no QA blocker is created from weak related tests alone. |
| Fixture secrets are not blocking | PASS | Fixture-like secret findings render under `Advisory Findings` with non-leak wording. |
| Blocking security still blocks | PASS | AI-Restaurants has `Blocking findings` `1` and `Merge recommendation` `blocked` because a real high/critical security finding remains. |
| Release checklist remains separate | PASS | Release findings continue to render under `Release Checklist` and do not count as blocking findings. |

## Remaining Calibration Gap

`wallet-health-ui` now has a meaningful UI-focused calibration run under `.calibration/wallet-health-ui/` with summary, full Markdown, and JSON artifacts. The run used a temporary copy of the repository so the original external repository stayed clean. The FastAPI and monorepo runs were optional and available, but their changed files were mostly generated/context artifacts, so they should not be treated as strong framework calibration evidence.

## wallet-health-ui Calibration Check

| Check | PASS/PARTIAL/FAIL | Evidence |
| --- | --- | --- |
| Changed files detected correctly | PASS | Guardian detected `src/app/page.tsx` as one modified source file in `.calibration/wallet-health-ui/guardian-report.json`. |
| UI QA signal useful | PASS | The report produced `qa-source-without-nearby-test` with low confidence and expected test signals for `page` component/page test locations. |
| Related test signal detected | PARTIAL | No related test was detected because `wallet-health-ui` has no test framework or existing test file pattern beyond Guardian's expected-path suggestions. |
| Review-only QA not rendered as blocking | PASS | Full report shows `Blocking Findings` as `No blocking findings`; the QA finding appears under `Review Findings`. |
| Wording avoids overclaiming | PASS | The report uses "test signal" wording and says Guardian did not find a clear nearby unit test signal rather than claiming guaranteed missing coverage. |
| Merge recommendation reasonable | PASS | `review_required` is appropriate for a meaningful UI source change with no related test change and zero blocking findings. |

## Final Recommendation

**v0.1.x complete**

The implementation-side closure goals passed, regenerated reports match current blocking logic, and `wallet-health-ui` now has a meaningful UI-focused changed-file calibration run. v0.1.x is ready to close and move to v0.2.x Test Signal Intelligence.
