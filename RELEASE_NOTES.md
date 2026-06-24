# Release Notes

## 0.2.0

### Added
- Added domain-specific suggested review guidance for auth, API, CLI, workflow, and config changes.
- Added grouped QA evidence in full Markdown reports, including changed files, detected tests, coverage signals, and suggested review items.
- Added output contract coverage for grouped QA evidence, domain suggestions, JSON serialization, SARIF compactness, and risk/decision invariance.

### Improved
- Kept report wording advisory with detected, unconfirmed, and suggested-review language.
- Kept summary and SARIF output compact while preserving detailed evidence in full Markdown and JSON reports.

## 0.1.2

### Improved
- Added Markdown onboarding guidance when `guardian.config.json` is missing.
- Added Project Brain guidance when `.project-brain` is missing.
- Improved first-run documentation in README.

### Fixed
- Prevented onboarding guidance from leaking into PR comment, JSON, and SARIF outputs.
- Prevented duplicate onboarding guidance in Markdown reports.
