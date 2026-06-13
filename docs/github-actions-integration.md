# GitHub Actions Integration

This workflow runs `ai-project-guardian` from another repository. It checks out the target repository, checks out Guardian into `.guardian`, installs Guardian dependencies, runs the CLI against the target repository, and appends a short report to the GitHub Actions job summary.

Guardian has two Markdown output modes:

- `--summary-only`: short overview for `GITHUB_STEP_SUMMARY`. This is the default.
- `--full-report`: complete report with changed files and detailed findings.

The summary includes Guardian's decision-support fields: `mergeRecommendation`, `blockingFindingsCount`, `checklistFindingsCount`, `codeRisk`, `releaseChecklistRisk`, and `riskReason`. These fields separate merge blockers from deploy checklist work without changing the existing `riskScore`, `overallRisk`, or `--fail-on` behavior. See `docs/report-decision-model.md` for examples.

Replace `your-org/ai-project-guardian` with the actual GitHub owner and repository for this tool.

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
      - name: Checkout target repository
        uses: actions/checkout@v4
        with:
          path: target
          fetch-depth: 0

      - name: Checkout ai-project-guardian
        uses: actions/checkout@v4
        with:
          repository: your-org/ai-project-guardian
          path: target/.guardian

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: target/.guardian/package-lock.json

      - name: Install guardian dependencies
        working-directory: target/.guardian
        run: npm ci

      - name: Build guardian
        working-directory: target/.guardian
        run: npm run build

      - name: Run guardian summary against target repo
        working-directory: target/.guardian
        run: npm run guardian -- --repo .. --base origin/main --out guardian-summary.md --summary-only --fail-on critical

      - name: Append summary to job summary
        run: cat target/.guardian/guardian-summary.md >> "$GITHUB_STEP_SUMMARY"

      - name: Generate full guardian report
        if: always()
        working-directory: target/.guardian
        run: npm run guardian -- --repo .. --base origin/main --out guardian-report.md --full-report

      - name: Upload guardian report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: target/.guardian/guardian-report.md
```
