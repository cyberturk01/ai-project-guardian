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
- `--summary-only`: write a short overview for GitHub Actions summaries. This is the default.
- `--full-report`: write the complete Markdown report with changed files, detailed findings, accepted findings, required actions, and suggested tests.
- `--fail-on <high|critical>`: exit with code 1 when the calculated risk meets the threshold. Defaults to not failing the build.
- `--help`: print CLI help.

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
  ]
}
```

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

The workflow checks out the target repo, checks out the `ai-project-guardian` repo, runs Guardian against the target repo, and writes `guardian-report.md` to the GitHub Actions summary.

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

Example configs are available in:

- `examples/ai-restaurants/guardian.config.json`
- `examples/togetherly/guardian.config.json`
- `examples/generic-saas/guardian.config.json`

## Risk baseline

Add `.guardian-baseline.json` to a target repository to accept known findings without counting them toward the overall score:

```json
{
  "acceptedFindings": [
    {
      "type": "release",
      "title": "GitHub Actions changed"
    }
  ]
}
```

Accepted findings are matched by `type` and `title`. They still appear in the report under `Accepted Findings`, but only new active findings affect the risk score.

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
      - run: npm run guardian -- --repo . --base origin/main --out guardian-summary.md --summary-only --fail-on critical
      - run: cat guardian-summary.md >> "$GITHUB_STEP_SUMMARY"
      - run: npm run guardian -- --repo . --base origin/main --out guardian-report.md --full-report
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
        run: npm run guardian -- --repo .. --base origin/main --out guardian-summary.md --summary-only

      - name: Append report to job summary
        run: cat target/.guardian/guardian-summary.md >> "$GITHUB_STEP_SUMMARY"
```

Replace `your-org/ai-project-guardian` with the actual owner and repository name for this project.

See `docs/github-actions-integration.md` for a complete copy-paste workflow.
