# ai-project-guardian

`ai-project-guardian` is a TypeScript CLI for analyzing another repository and producing QA, release, and security risk reports that can be published from GitHub Actions.

This is not a SaaS app. It is a local and CI-friendly repository analysis tool.

## Purpose

AI-assisted projects can move quickly, but teams still need a repeatable way to ask:

- What changed?
- What needs QA attention?
- What could block a release?
- What security-sensitive areas deserve review?

`ai-project-guardian` will provide a command-line workflow for generating those reports from repository state.

## MVP scope

The MVP will focus on:

- Running as a TypeScript-based CLI.
- Reading configuration from CLI flags, environment variables, or a config file.
- Inspecting a target repository path.
- Producing Markdown reports for QA, release readiness, and security risk.
- Running cleanly in GitHub Actions.

The current project includes initial heuristic analyzers for changed files, QA coverage gaps, release-sensitive changes, and security review signals.

## Non-goals

- No hosted dashboard.
- No SaaS backend.
- No persistent user accounts.
- No automatic code modification.
- No replacement for dedicated SAST, dependency scanning, or test coverage tools.

## Usage

Install dependencies and build the CLI:

```sh
npm install
npm run build
```

Run the CLI against another repository:

```sh
npm run guardian -- --repo ../AI-Restaurants --base origin/main --out guardian-report.md
```

Available flags:

- `--repo <path>`: target repository to inspect. Defaults to `GUARDIAN_REPO_PATH` or `.`.
- `--base <ref>`: base git ref for changed-file detection. Defaults to `origin/main`, then falls back to `HEAD~1` when the default ref is unavailable.
- `--out <path>`: optional output file. Defaults to `GUARDIAN_OUTPUT_PATH` when set.
- `--fail-on <high|critical>`: exit with code 1 when the calculated risk meets the threshold. Defaults to not failing the build.
- `--help`: print CLI help.

## GitHub Actions

Example workflow:

```yaml
name: Guardian Report

on:
  pull_request:
  workflow_dispatch:

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run guardian -- --repo . --base origin/main --out guardian-report.md --fail-on critical
      - uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: guardian-report.md
```

The repository also includes `.github/workflows/guardian.yml` as a starting point.

## Use from another GitHub repository

To run `ai-project-guardian` from a different repository, checkout the target project first, then checkout this tool into a nested `.guardian` directory.

```yaml
name: Guardian Report

on:
  pull_request:
  workflow_dispatch:

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
```

Replace `your-org/ai-project-guardian` with the actual owner and repository name for this project.

See `docs/github-actions-integration.md` for a complete copy-paste workflow.
