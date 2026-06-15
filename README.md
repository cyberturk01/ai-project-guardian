# ai-project-guardian

![npm](https://img.shields.io/npm/dm/ai-project-guardian)
![npm](https://img.shields.io/npm/v/ai-project-guardian)

`ai-project-guardian` is a TypeScript CLI for analyzing another repository and producing QA, release, security, workflow, coverage, and external-scanner risk reports that can be published from GitHub Actions.

This is not a SaaS app. It is a local and CI-friendly repository analysis tool.

## Purpose

AI-assisted projects can move quickly, but teams still need a repeatable way to ask:

- What changed?
- What needs QA attention?
- What could block a release?
- What security-sensitive areas deserve review?

`ai-project-guardian` provides a local command-line workflow for generating those reports from repository state and optional local scanner artifacts.

## Current Capabilities

Guardian currently supports:

- Changed-file classification across source, tests, migrations, config, CI, documentation, i18n, security, and Project Brain context files.
- QA heuristics for missing nearby tests, API/integration tests, Cypress coverage, DB/integration tests, localization tests, and negative auth/security tests.
- Release heuristics for migrations, package/dependency changes, environment config changes, and GitHub Actions changes.
- Workflow validation for required GitHub Actions checks configured per repository.
- Security heuristics for hardcoded secrets, API keys, JWT/default secret fallbacks, sensitive logs, SQL interpolation, auth bypasses, CORS wildcards, route auth, and rate limiting.
- Optional coverage awareness from `coverage-final.json` or `lcov.info`.
- Repository-defined business areas and custom deterministic rules.
- Accepted-findings baselines through `.guardian-baseline.json`.
- Risk scoring with critical escalation for high-risk combinations.
- Decision-support fields that separate blocking findings from release checklist items.
- Markdown, JSON, SARIF, GitHub Actions summary, and PR-comment-style output.
- Local Enterprise Risk Correlation by importing SARIF, CodeQL, Semgrep, and Snyk artifacts without calling external APIs.

## Non-goals

- No hosted dashboard.
- No SaaS backend.
- No persistent user accounts.
- No automatic code modification.
- No GitHub API requirement for report generation or PR comment text generation.
- No replacement for dedicated SAST, dependency scanning, or test coverage tools.

## NPM Beta Quickstart

From the repository you want Guardian to monitor:

```sh
npx ai-project-guardian@beta --help
npx ai-project-guardian@beta init --dry-run
npx ai-project-guardian@beta init
```

`init` creates `guardian.config.json`, `.project-brain/` template files, and `.github/workflows/ai-project-guardian.yml` when they are missing. Review the generated files before committing them or relying on CI output.

## Beta Status

This beta produces advisory output. Release checklist items need human review, and no deployment should be blocked only by generic checklist items without project-specific confirmation.

## Usage

Verify a local package tarball:

```sh
npm pack
npx ./ai-project-guardian-*.tgz --help
```

Install globally:

```sh
npm install -g ai-project-guardian
ai-project-guardian --repo ../AI-Restaurants --base origin/main --out guardian-report.md
```

Install dependencies and build the CLI:

```sh
npm install
npm run build
```

Run the CLI against another repository:

```sh
npm run guardian -- --repo ../AI-Restaurants --base origin/main --out guardian-report.md
```

Write a full Markdown report:

```sh
npm run guardian -- --repo ../AI-Restaurants --base origin/main --out guardian-report.md --full-report
```

## Init Presets

Bootstrap Guardian in a repository:

```sh
npx ai-project-guardian@beta init --dry-run
npx ai-project-guardian@beta init --preset python
npx ai-project-guardian@beta init --preset monorepo
```

Existing files are skipped unless `--force` is set. Supported config presets are `generic`, `node-api`, `web-app`, `python`, and `monorepo`.

When `--preset` is omitted, init chooses a best-effort preset from local project files. Python markers such as `pyproject.toml` or `requirements.txt` select `python`; workspace markers such as `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `packages/`, `apps/`, or `libs/` select `monorepo`; Node API and web app markers select `node-api` or `web-app`; otherwise Guardian uses `generic`.

Write SARIF for GitHub code scanning:

```sh
npm run guardian -- --repo ../AI-Restaurants --base origin/main --format sarif --out guardian.sarif
```

Import local scanner artifacts and correlate them with Guardian findings:

```sh
npm run guardian -- \
  --repo ../AI-Restaurants \
  --base origin/main \
  --full-report \
  --sarif reports/generic.sarif \
  --codeql reports/codeql.sarif \
  --semgrep reports/semgrep.json \
  --snyk reports/snyk.json \
  --out guardian-report.md
```

Available flags:

- `--repo <path>`: target repository to inspect. Defaults to `GUARDIAN_REPO_PATH` or `.`.
- `--base <ref>`: base git ref for changed-file detection. Defaults to `origin/main`, then `main`, then `master`, then `HEAD~1`.
- `--out <path>`: optional output file. Defaults to `GUARDIAN_OUTPUT_PATH` when set. Without `--out`, the report is written to stdout.
- `--format <markdown|json|sarif>`: report format. Defaults to `markdown`.
- `--sarif <path>`: import a local SARIF artifact. Can be repeated.
- `--codeql <path>`: import a local CodeQL SARIF artifact. Can be repeated.
- `--semgrep <path>`: import a local Semgrep JSON or SARIF artifact. Can be repeated.
- `--snyk <path>`: import a local Snyk JSON or SARIF artifact. Can be repeated.
- `--summary-only`: write a short overview for GitHub Actions summaries. This is the default.
- `--full-report`: write the complete Markdown report with changed files, detailed findings, accepted findings, required actions, and suggested tests.
- `--pr-comment`: write compact Markdown suitable for a GitHub PR comment. It does not call the GitHub API.
- `--preset <generic|node-api|web-app|python|monorepo>`: choose the config preset for `init`. Defaults to best-effort detection.
- `--fail-on <high|critical>`: exit with code 1 when the calculated risk meets the threshold. Defaults to not failing the build.
- `--help`: print CLI help.

Equivalent environment variables:

- `GUARDIAN_REPO_PATH`
- `GUARDIAN_BASE_REF`
- `GUARDIAN_OUTPUT_PATH`
- `GUARDIAN_REPORT_FORMAT`
- `GUARDIAN_SARIF_PATHS`
- `GUARDIAN_CODEQL_PATHS`
- `GUARDIAN_SEMGREP_PATHS`
- `GUARDIAN_SNYK_PATHS`

Multiple artifact paths in environment variables are comma-separated.

## Onboarding a New Repository

Guardian can run with defaults, but analysis quality is better when the target repository provides repository-specific config and Project Brain context.

Each target repository should add:

- `guardian.config.json`
- `.project-brain/`
- `.github/workflows/ai-project-guardian.yml`

### 1. Add guardian.config.json

Add `guardian.config.json` at the target repository root:

```json
{
  "projectName": "My Project",
  "riskFolders": [
    "src/routes",
    "src/services",
    "src/auth",
    "src/config"
  ],
  "testFolders": [
    "tests",
    "cypress",
    "__tests__"
  ],
  "releaseSensitiveFiles": [
    "package.json",
    "package-lock.json",
    ".env.example",
    ".github/workflows"
  ],
  "requiredChecks": [
    "npm test",
    "npm run lint"
  ],
  "coverageThreshold": 80,
  "customRules": [
    {
      "id": "email-change-requires-test",
      "whenChanged": "src/email/**",
      "requiresTest": "tests/email/**",
      "risk": "high"
    }
  ]
}
```

Coverage awareness is optional. When `coverage-final.json` or `lcov.info` exists at the repository root or under `coverage/`, Guardian flags changed source files below `coverageThreshold`.

`customRules` are optional. They are deterministic path rules for repositories that need project-specific QA or release checks without changing Guardian source code.

### 2. Add Project Brain

Add `.project-brain/` at the target repository root:

```text
.project-brain/
  project.md
  architecture.md
  testing-strategy.md
  deployment-rules.md
  security-rules.md
  known-risks.md
  known-bugs.md
  module-map.json
```

- `project.md`: what the application does, business flows, and critical user journeys.
- `architecture.md`: backend, frontend, database, migrations, and external integrations.
- `testing-strategy.md`: test types, coverage expectations, and regression-critical areas.
- `deployment-rules.md`: stage/prod separation, environment variables, migration caution, and release checks.
- `security-rules.md`: auth rules, secret handling, privacy-sensitive data, and commit restrictions.
- `known-risks.md`: risky flows, fragile modules, and areas needing extra release review.
- `known-bugs.md`: unresolved issues, or empty when there are no known current issues.
- `module-map.json`: important folders mapped to business areas.

### Quick Start Prompt for Project Brain

Use this prompt with an AI coding agent in the target repository:

```text
Create a .project-brain folder for this repository.

Goal:
Provide structured context for AI Project Guardian and future AI coding agents.

Create:
.project-brain/
  project.md
  architecture.md
  testing-strategy.md
  deployment-rules.md
  security-rules.md
  known-risks.md
  known-bugs.md
  module-map.json

Content requirements:
1. project.md:
   - Explain what this application does.
   - Mention important business flows and critical user journeys.

2. architecture.md:
   - Explain backend structure.
   - Explain frontend structure.
   - Explain database/migration structure.
   - Explain external integrations.

3. testing-strategy.md:
   - Explain existing test types.
   - Mention coverage requirements.
   - Mention critical areas that need regression tests.

4. deployment-rules.md:
   - Explain stage/prod separation.
   - Mention required environment variables.
   - Mention migration caution.
   - Mention release checks.

5. security-rules.md:
   - Mention authentication and authorization rules.
   - Mention secret handling.
   - Mention privacy-sensitive data handling.
   - Mention what must never be committed.

6. known-risks.md:
   - List known risky flows.
   - List fragile modules.
   - List areas that need extra review before release.

7. known-bugs.md:
   - Keep empty if there are no known current issues.
   - Otherwise list known unresolved bugs.

8. module-map.json:
   - Map important folders to business areas.

Do not change application logic.
Only add documentation/context files.
```

### 3. Add GitHub Actions workflow

Each target repository should add:

```text
.github/workflows/ai-project-guardian.yml
```

The generated workflow checks out the target repo, runs Guardian with `npx --yes ai-project-guardian`, and writes `guardian-report.md` to the GitHub Actions summary.

See `docs/github-actions-integration.md` for a complete workflow.

### Recommended Repository Layout

```text
repository-root/
  guardian.config.json
  .project-brain/
  .github/workflows/ai-project-guardian.yml
```

## Business Areas

Every product has business-critical paths that generic repository heuristics cannot fully understand. `ai-project-guardian` supports project-specific business rules through `guardian.config.json` so each repository can describe its own risky areas without changing Guardian code.

Add a `businessAreas` array to the target repository config:

```json
{
  "projectName": "AI-Restaurants",
  "businessAreas": [
    {
      "name": "consent",
      "description": "Consent, privacy policy, and audit evidence flow",
      "riskLevel": "high",
      "paths": [
        "src/consent",
        "src/privacy",
        "src/routes/consentRoutes.ts"
      ],
      "requiredTestHints": [
        "consent",
        "privacy",
        "audit"
      ],
      "requiredBeforeDeploy": [
        "Confirm consent audit evidence is still written",
        "Confirm privacy policy versioning is not broken"
      ]
    }
  ]
}
```

When a changed file matches a business area path, Guardian can add:

- A QA finding when no existing or changed test file path matches `requiredTestHints`.
- A release finding when `requiredBeforeDeploy` contains deploy checklist items.
- Required actions in the report based on `requiredBeforeDeploy`.

Path matching supports exact file paths, folder prefixes, and simple substring matches. Test hint matching is deterministic and checks test file paths from the existing repository file list and changed test files. Guardian does not make AI or LLM calls for this behavior.

New projects only need a `guardian.config.json` to define their business areas. They can optionally add `.project-brain` files for extra human-readable context and team conventions.

## Custom Rules

Repositories can also define deterministic path-based QA and release rules in `guardian.config.json`:

```json
{
  "customRules": [
    {
      "id": "email-change-requires-test",
      "whenChanged": "src/email/**",
      "requiresTest": "tests/email/**",
      "risk": "high"
    },
    {
      "id": "deploy-config-review",
      "whenChanged": "config/deploy/**",
      "risk": "high",
      "requiredBeforeDeploy": [
        "Review deploy config with release owner"
      ]
    }
  ]
}
```

`requiresTest` creates a QA finding when matching files changed and no repository file matches the test glob. `requiredBeforeDeploy` creates a release finding and adds checklist items to the report. Glob matching supports `*` within one path segment and `**` across nested paths.

Optional custom rule fields:

- `title`: custom finding title.
- `description`: custom finding description.
- `whyItMatters`: release context for deploy reviewers.

Example configs are available in:

- `examples/ai-restaurants/guardian.config.json`
- `examples/togetherly/guardian.config.json`
- `examples/generic-saas/guardian.config.json`

## Coverage Awareness

Guardian reads coverage artifacts when they exist in the target repository:

- `coverage-final.json`
- `coverage/coverage-final.json`
- `lcov.info`
- `coverage/lcov.info`

Changed source files below `coverageThreshold` create a medium-risk QA finding named `Changed code has low test coverage`. Coverage awareness is optional and local-only; Guardian does not run tests or generate coverage itself.

## External Scanner Correlation

Enterprise Risk Correlation imports local scanner artifacts and folds them into the report:

- generic SARIF via `--sarif`
- CodeQL SARIF via `--codeql`
- Semgrep JSON or SARIF via `--semgrep`
- Snyk JSON or SARIF via `--snyk`

Guardian parses these files locally, deduplicates external findings, and correlates them with Guardian security findings by file, line, and normalized title. Correlations are reported as `single-tool` or `multi-tool`; multi-tool critical correlations can elevate overall risk.

## Report Decision Model

Guardian keeps the existing `riskScore` and `overallRisk` scoring behavior, then adds decision-support fields to make release decisions easier to read:

- `codeRisk`: highest active blocking code/test/security/workflow/external/correlated risk. Auth/security score bands can keep this elevated even after blocking findings clear.
- `releaseChecklistRisk`: highest active release checklist risk.
- `blockingFindingsCount`: active QA, security, workflow, external scanner, and correlated findings. These represent work that can block merge or require review.
- `checklistFindingsCount`: active release findings. These are deploy-readiness checklist items, not code-location blockers.
- `mergeRecommendation`: one of `blocked`, `review_required`, `safe_after_checklist`, or `safe`.
- `riskReason`: short explanation for the recommendation, such as missing negative auth tests, security findings, checklist-only risk, or no remaining blockers.

Examples:

| Scenario | Blocking findings | Checklist findings | Merge recommendation | Risk reason |
| --- | ---: | ---: | --- | --- |
| Auth/security code changed without negative tests | 1+ | any | `blocked` | `Auth/security changed without negative test coverage.` |
| Auth/security code changed with negative tests, and only release checklist items remain | 0 | 1+ | `safe_after_checklist` | `Only release checklist items remain.` |
| Real secret or security finding | 1+ | any | `blocked` for high/critical code risk, `review_required` for lower-severity blocking risk | `Security findings require review.` |

See `docs/report-decision-model.md` for a longer explanation of how these fields should be used in CI and PR review.

## Troubleshooting

### `fatal: bad revision 'origin/main...HEAD'`

This means Git cannot resolve the configured comparison ref in the target repository. It often happens in local repositories that have no `origin/main` remote-tracking branch, in repositories that use a different default branch, or in shallow CI checkouts.

Guardian validates the requested base ref before diffing. If `--base` is invalid, it falls back to `HEAD~1` when available and prints a warning. If no base is provided, Guardian tries `origin/main`, then `main`, then `master`, then `HEAD~1`.

Useful alternatives:

```sh
npx ai-project-guardian@beta --repo . --base HEAD~1
git fetch origin main
git branch -a
```

## Output Modes

Guardian can render:

- Markdown summary: default mode for GitHub Actions summaries.
- Full Markdown report: `--full-report`.
- PR comment Markdown: `--pr-comment`.
- JSON: `--format json`.
- SARIF: `--format sarif`.

SARIF output includes QA, security, workflow, and external/correlated scanner findings. Release findings stay in Markdown/JSON reports because they are checklist-oriented rather than code-location-oriented.

## Risk baseline

Add `.guardian-baseline.json` to a target repository to accept known findings without counting them toward the overall score:

```json
{
  "acceptedFindings": [
    {
      "type": "workflow",
      "title": "GitHub Actions changed"
    }
  ]
}
```

Accepted findings are matched by `type` and `title`. They still appear in the report under `Accepted Findings`, but only new active findings affect the risk score.

## Analyzer Accuracy Baseline

The repository includes integration fixtures under `tests/test-fixtures/analyzer-accuracy/` that run Guardian against simulated repositories for:

- auth changes without tests
- migration changes without DB tests
- workflow changes
- hardcoded secrets
- docs-only changes
- config-only changes

The accuracy report lives at `.project-brain/metrics/ANALYZER_ACCURACY_REPORT.md`. These tests measure current analyzer behavior before new analyzer features are added.

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
      - run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-summary.md --summary-only --fail-on critical
      - run: cat guardian-summary.md >> "$GITHUB_STEP_SUMMARY"
      - run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-report.md --full-report
      - uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: guardian-report.md
```

This repository also includes `.github/workflows/guardian-self-check.yml` to run Guardian against itself.

## Use from another GitHub repository

To run `ai-project-guardian` from a GitHub repository, install nothing in the repo; the generated workflow uses `npx --yes ai-project-guardian`.

```yaml
name: Guardian Report

on:
  pull_request:
  workflow_dispatch:

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

      - name: Run guardian against target repo
        run: npx --yes ai-project-guardian --repo . --base origin/main --out guardian-summary.md --summary-only

      - name: Append report to job summary
        run: cat guardian-summary.md >> "$GITHUB_STEP_SUMMARY"
```

See `docs/github-actions-integration.md` for a complete copy-paste workflow.
