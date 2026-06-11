# Analyzer Accuracy Report

Date: 2026-06-11

Scope: current analyzer suite only. No analyzer logic was changed for this audit.

## Fixture Matrix

| Fixture | Expected active findings | Unexpected findings guarded against | Expected overall risk |
| --- | --- | --- | --- |
| auth change without tests | `qa-auth-security-without-negative-test` | migration, workflow, hardcoded secret findings | `critical` |
| migration change without DB tests | `qa-migration-without-db-test`, `release-migration-changed` | auth, workflow, hardcoded secret findings | `critical` |
| workflow change | `release-github-actions-changed`, `workflow-missing-required-check-npm-test` | auth, migration, hardcoded secret findings | `low` |
| hardcoded secret | `security-hardcoded-secret` | auth, migration, workflow findings | `high` |
| docs-only change | none | auth, migration, workflow, hardcoded secret findings | `info` |
| config-only change | none | auth, migration, workflow, hardcoded secret findings | `low` |

## Current Accuracy Baseline

- Fixture count: 6
- Expected finding checks: 6
- Unexpected finding guard checks: 31
- Risk-level checks: 6

The integration suite treats all checks above as the baseline for current analyzer accuracy. A future analyzer change should update the fixture manifest and this report only when the behavior change is intentional.

## Notable Measurement

Workflow-only changes currently produce high-severity workflow/release findings, but the overall risk remains `low` because the workflow risk band caps the score at 40. This report records that behavior without changing the scorer.
