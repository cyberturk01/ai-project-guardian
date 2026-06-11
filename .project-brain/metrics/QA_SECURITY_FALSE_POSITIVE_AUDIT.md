# QA and Security False Positive Audit

Date: 2026-06-11

Scope: QA and Security analyzer accuracy only. No new finding types were added.

## Filename-Heuristic Findings Reviewed

| Analyzer | Finding | Filename-only risk reviewed | Change |
| --- | --- | --- | --- |
| QA | `qa-api-without-integration-test` | API-like test filenames can match route/API path patterns. | Ignore changed test files for production API coverage gaps. |
| QA | `qa-ui-without-cypress-test` | UI-like test filenames can match component/page path patterns. | Ignore changed test files for production UI coverage gaps. |
| QA | `qa-migration-without-db-test` | Test files under migration-like paths can match migration path patterns. | Ignore changed test files for production migration coverage gaps. |
| QA | `qa-i18n-without-localization-test` | Test files under i18n/locales paths can match localization path patterns. | Ignore changed test files for production i18n coverage gaps. |
| QA | `qa-auth-security-without-negative-test` | Test files under auth/security paths can be classified as security-sensitive code. | Ignore changed test files for production auth/security coverage gaps. |
| Security | `security-new-route-missing-auth-middleware` | Added test files with route-like names and fixture routes can look like production routes. | Ignore test files for route middleware presence checks. |
| Security | `security-new-route-missing-rate-limit` | Added test files with route-like names and fixture routes can look like production routes. | Ignore test files for route rate-limit checks. |

## Before/After Counts

Counts are from the new regression scenarios added in `qaAnalyzer.test.ts` and `securityAnalyzer.test.ts`.

| Scenario | Before | After |
| --- | ---: | ---: |
| Changed auth/migration/i18n test files reported as QA production coverage gaps | 1 | 0 |
| Added route test file reported as missing auth middleware and rate limiting | 2 | 0 |
| Total false-positive findings in audited scenarios | 3 | 0 |

## Verification

- Existing analyzer accuracy fixtures still pass.
- Existing QA and Security positive detections still pass.
- Full suite: `npm test` passes with 96 tests.
