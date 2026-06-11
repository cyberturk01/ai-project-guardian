# Analyzer Accuracy Fixtures

Each fixture is a repository snapshot pair used by `tests/analyzerAccuracy.integration.test.ts`.

- `baseline/` is committed first and marked as `origin/main`.
- `head/` is copied over the baseline and committed as the pull-request-style change.
- `manifest.json` records the expected Guardian findings and overall risk for the current analyzer suite.

These fixtures are measurement assets only. They should change when analyzer behavior intentionally changes.
