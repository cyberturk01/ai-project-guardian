# GitHub Actions Integration

This workflow runs `ai-project-guardian` from another repository. It checks out the target repository, checks out Guardian into `.guardian`, installs Guardian dependencies, runs the CLI against the target repository, and appends the report to the GitHub Actions job summary.

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

      - name: Run guardian against target repo
        working-directory: target/.guardian
        run: npm run guardian -- --repo .. --base origin/main --out guardian-report.md

      - name: Append report to job summary
        run: cat target/.guardian/guardian-report.md >> "$GITHUB_STEP_SUMMARY"

      - name: Upload guardian report
        uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: target/.guardian/guardian-report.md
```
