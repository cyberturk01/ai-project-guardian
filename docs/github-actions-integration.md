# GitHub Actions Integration

This workflow runs `ai-project-guardian` from npm with `npx`. It checks out the target repository, runs the CLI against that repository, and appends a short report to the GitHub Actions job summary.

Guardian has two Markdown output modes:

- `--summary-only`: short overview for `GITHUB_STEP_SUMMARY`. This is the default.
- `--full-report`: complete report with changed files and detailed findings.

The summary includes Guardian's decision-support fields: `mergeRecommendation`, `blockingFindingsCount`, `checklistFindingsCount`, `codeRisk`, `releaseChecklistRisk`, and `riskReason`. These fields separate merge blockers from deploy checklist work without changing the existing `riskScore`, `overallRisk`, or `--fail-on` behavior. See `docs/report-decision-model.md` for examples.

```yaml
name: Guardian Report

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read

jobs:
  guardian:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run guardian summary against target repo
        run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-summary.md --summary-only --fail-on critical

      - name: Append summary to job summary
        run: cat guardian-summary.md >> "$GITHUB_STEP_SUMMARY"

      - name: Generate full guardian report
        if: always()
        run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-report.md --full-report

      - name: Upload guardian report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: guardian-report.md
```
