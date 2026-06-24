# AI Project Guardian

![npm](https://img.shields.io/npm/dm/ai-project-guardian)
![npm](https://img.shields.io/npm/v/ai-project-guardian)

Repository risk review for AI-assisted development, QA, release, and security checks.

Status: early release / usable MVP.

AI Project Guardian is a local and CI-friendly repository risk review CLI. It looks at what changed in a repository, classifies the risk, and produces readable reports for developers, QA engineers, SDETs, maintainers, and teams using AI coding agents.

It is not a SaaS. There is no account, no hosted dashboard, and no code upload. Guardian runs locally or in GitHub Actions, does not modify your code, and can produce Markdown, JSON, SARIF, GitHub Actions summary, and PR-comment style output.

Guardian complements scanners and tests. It does not replace CodeQL, Semgrep, Snyk, dependency audits, test coverage, or human review; it adds a deterministic repository-change review layer around them.

## Why Guardian?

AI coding agents can change a lot of files quickly. That speed is useful, but it also makes reviews harder: a small prompt can touch auth code, migrations, workflows, package locks, generated files, tests, and documentation in one pass.

Guardian gives teams a repeatable way to ask the same release-minded questions every time:

- What changed?
- What risk did this change introduce?
- Are tests missing near changed code?
- Did dependency, workflow, migration, auth, security, or release-sensitive files change?
- Is this PR safe, checklist-required, review-required, or blocked?

The goal is not to replace reviewers. The goal is to make the first review pass calmer, faster, and less dependent on someone manually noticing every risky file.

## Who Is It For?

- Developers using AI coding agents.
- QA engineers and SDETs looking for lightweight PR risk summaries.
- Solo maintainers who want release checks without a heavy platform.
- Small teams without formal release governance.
- Open-source maintainers reviewing broad or unfamiliar contributions.
- Teams that want local reports before opening a PR and CI summaries after opening one.

## When Should I Use It?

Use Guardian:

- Before opening a pull request.
- Inside GitHub Actions on PRs.
- After AI-generated changes.
- Before release.
- After dependency or lockfile changes.
- After auth, security, workflow, migration, config, or release-sensitive changes.
- When a PR touches many files and you want a deterministic review summary.

## What Does It Check?

Guardian currently supports:

- Changed-file classification across source, tests, migrations, config, CI, documentation, i18n, security, generated reports, and Project Brain context files.
- QA/test heuristics for missing nearby tests, API/integration coverage, component/e2e coverage, DB/migration tests, localization tests, and negative auth/security tests.
- Release checklist findings for migrations, dependency changes, environment config changes, GitHub Actions changes, and repository-defined deploy rules.
- Security heuristics for hardcoded secrets, API keys, JWT/default secret fallbacks, sensitive logs, SQL interpolation, auth bypasses, CORS wildcards, route auth, and rate limiting.
- Workflow checks for required GitHub Actions commands configured per repository.
- Optional coverage awareness from `coverage-final.json` or `lcov.info`.
- External scanner correlation from local SARIF, CodeQL, Semgrep, and Snyk artifacts.
- Project-specific configuration through `guardian.config.json`.
- Project Brain context through `.project-brain/`.
- Accepted-findings baselines through `.guardian-baseline.json`.

## Quick Start

From the repository you want Guardian to review:

```bash
npx ai-project-guardian@latest --help
npx ai-project-guardian@latest init --dry-run
npx ai-project-guardian@latest init
npx ai-project-guardian@latest --repo . --out guardian-summary.md --summary-only
npx ai-project-guardian@latest --repo . --out guardian-report.md --full-report
```

`init` creates these files when they are missing:

- `guardian.config.json`
- `.project-brain/*`
- `.github/workflows/ai-project-guardian.yml`

Review generated files before committing them. Guardian works without config, but the reports improve when the repository describes its own test folders, release-sensitive paths, business areas, and required checks.

## Example Output

```md
Risk score: 41/100
Overall risk: medium
Merge recommendation: review_required
Blocking findings: 0
Release checklist findings: 1
Security findings: 0
Actionable guidance items: 5
```

Merge recommendations:

- `safe`: no active findings that need special review.
- `safe_after_checklist`: no blocking code/test/security findings, but release checklist items remain.
- `review_required`: lower-severity blocking findings need human review before merge.
- `blocked`: high-risk or critical findings should be fixed or explicitly accepted before merge.

## GitHub Actions Usage

```yaml
name: AI Project Guardian

on:
  pull_request:
  workflow_dispatch:

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Guardian
        run: |
          npx --yes ai-project-guardian@latest \
            --repo . \
            --out guardian-summary.md \
            --summary-only

      - name: Add report to GitHub summary
        run: cat guardian-summary.md >> $GITHUB_STEP_SUMMARY
```

For stricter CI behavior, add `--fail-on high` or `--fail-on critical`.

## Local Usage

Install dependencies and build the CLI from this repository:

```bash
npm install
npm run build
```

Run the local build against another repository:

```bash
npm run guardian -- --repo ../AI-Restaurants --base origin/main --out guardian-report.md --full-report
```

Verify a package tarball:

```bash
npm pack
npx ./ai-project-guardian-*.tgz --help
```

Install globally:

```bash
npm install -g ai-project-guardian
ai-project-guardian --repo . --out guardian-summary.md --summary-only
```

Local runs include committed branch changes compared to the resolved base ref, plus staged, unstaged, and untracked files in the target repository. When local working tree changes are included, Guardian adds a note to the report.

Guardian ignores its own generated reports and common local build/package artifacts by default, including `guardian-*.md`, `*.tgz`, `*.tar.gz`, `build/`, `dist/`, `out/`, `coverage/`, `.next/`, cache folders, and `node_modules/`.

## CLI Options

- `--repo <path>`: target repository to inspect. Defaults to `GUARDIAN_REPO_PATH` or `.`.
- `--base <ref>`: base git ref for changed-file detection. Defaults to `origin/main`, then `main`, then `master`, then `HEAD~1`.
- `--out <path>`: optional output file. Defaults to `GUARDIAN_OUTPUT_PATH` when set.
- `--format <markdown|json|sarif>`: report format. Defaults to `markdown`.
- `--summary-only`: write a short overview for GitHub Actions summaries. This is the default.
- `--full-report`: write the complete Markdown report.
- `--pr-comment`: write compact Markdown suitable for a GitHub PR comment. Guardian does not call the GitHub API.
- `--sarif <path>`: import a local SARIF artifact. Can be repeated.
- `--codeql <path>`: import a local CodeQL SARIF artifact. Can be repeated.
- `--semgrep <path>`: import a local Semgrep JSON or SARIF artifact. Can be repeated.
- `--snyk <path>`: import a local Snyk JSON or SARIF artifact. Can be repeated.
- `--preset <generic|generic-cli|node-api|web-app|python|monorepo>`: choose the config preset for `init`.
- `--fail-on <high|critical>`: exit with code 1 when overall risk meets the threshold.
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

## Project-Specific Configuration

Guardian works without config, but analysis quality improves with `guardian.config.json`:

```json
{
  "projectName": "My Project",
  "riskFolders": ["src/routes", "src/services", "src/auth", "src/config"],
  "testFolders": ["tests", "cypress", "__tests__"],
  "releaseSensitiveFiles": ["package.json", "package-lock.json", ".env.example", ".github/workflows"],
  "requiredChecks": ["npm test", "npm run lint"],
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

Missing config and missing Project Brain files are onboarding notes, not risk amplifiers.

### Project Brain

`.project-brain/` gives Guardian and AI coding agents repository context:

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

Use it to describe critical user journeys, architecture, test expectations, deployment rules, security conventions, fragile modules, and business areas.

## Presets

`init` supports these presets:

- `generic`
- `generic-cli`
- `node-api`
- `web-app`
- `python`
- `monorepo`

Example:

```bash
npx ai-project-guardian@latest init --preset web-app
```

When `--preset` is omitted, Guardian chooses a best-effort preset from local project files. Workspace markers such as `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, package workspaces, or multiple package boundaries select `monorepo`; Python markers such as `pyproject.toml`, `requirements.txt`, or FastAPI-style `app/main.py` select `python`; React, Next, Vite, Angular, Vue, and Svelte markers select `web-app`; Node API markers select `node-api`; CLI package markers select `generic-cli`; otherwise Guardian uses `generic`.

## Business Areas And Custom Rules

Every product has business-critical paths that generic heuristics cannot fully understand. `guardian.config.json` can define business areas and deterministic custom rules without changing Guardian source code.

```json
{
  "businessAreas": [
    {
      "name": "consent",
      "description": "Consent, privacy policy, and audit evidence flow",
      "riskLevel": "high",
      "paths": ["src/consent", "src/privacy", "src/routes/consentRoutes.ts"],
      "requiredTestHints": ["consent", "privacy", "audit"],
      "requiredBeforeDeploy": [
        "Confirm consent audit evidence is still written",
        "Confirm privacy policy versioning is not broken"
      ]
    }
  ],
  "customRules": [
    {
      "id": "deploy-config-review",
      "whenChanged": "config/deploy/**",
      "risk": "high",
      "requiredBeforeDeploy": ["Review deploy config with release owner"]
    }
  ]
}
```

Business areas can add QA findings when matching tests are missing and release findings when deploy checklist items are required. Custom rules support `requiresTest` and `requiredBeforeDeploy`.

Example configs are available in:

- `examples/ai-restaurants/guardian.config.json`
- `examples/togetherly/guardian.config.json`
- `examples/generic-saas/guardian.config.json`

## External Scanner Correlation

Guardian can import local scanner outputs:

- SARIF via `--sarif`
- CodeQL SARIF via `--codeql`
- Semgrep JSON or SARIF via `--semgrep`
- Snyk JSON or SARIF via `--snyk`

Example:

```bash
npx ai-project-guardian@latest \
  --repo . \
  --full-report \
  --sarif reports/generic.sarif \
  --codeql reports/codeql.sarif \
  --semgrep reports/semgrep.json \
  --snyk reports/snyk.json \
  --out guardian-report.md
```

Guardian parses these files locally. It does not call external scanner APIs.

## Output Modes

Guardian can render:

- Markdown summary: default mode for GitHub Actions summaries.
- Full Markdown report: `--full-report`.
- PR comment Markdown: `--pr-comment`.
- JSON: `--format json`.
- SARIF: `--format sarif`.

SARIF output includes QA, security, workflow, external, and correlated scanner findings. Release findings stay in Markdown/JSON reports because they are checklist-oriented rather than code-location-oriented.

## Report Decision Model

Guardian separates code/test/security blockers from release checklist items:

- `codeRisk`: highest active blocking code/test/security/workflow/external/correlated risk.
- `releaseChecklistRisk`: highest active release checklist risk.
- `blockingFindingsCount`: active QA, security, workflow, external scanner, and correlated findings.
- `checklistFindingsCount`: active release findings.
- `mergeRecommendation`: one of `blocked`, `review_required`, `safe_after_checklist`, or `safe`.
- `riskReason`: short explanation for the recommendation.

Examples:

| Scenario | Blocking findings | Checklist findings | Merge recommendation |
| --- | ---: | ---: | --- |
| Docs-only change | 0 | 0 | `safe` |
| Workflow changed | 0 | 1+ | `safe_after_checklist` |
| Source changed without nearby tests | 1+ | any | `review_required` |
| Auth/security-sensitive code changed with no related test signal | 1+ | any | `blocked` |
| High or critical scanner/security finding | 1+ | any | `blocked` |

See `docs/report-decision-model.md` for a longer explanation.

## What Guardian Is Not

Guardian is:

- Not a hosted dashboard.
- Not a SaaS.
- Not a replacement for SAST.
- Not a replacement for dependency audit.
- Not a replacement for tests.
- Not a replacement for human review.
- Not an automatic code fixer.
- Not a tool that uploads your repository by default.

## Example Use Cases

- An AI agent changed 12 files; Guardian summarizes risk before the PR is opened.
- `package-lock.json` changed; Guardian asks for clean install, build, test, and dependency audit.
- Auth middleware changed; Guardian blocks until security review or negative test coverage is added.
- A docs-only change stays low risk.
- A workflow changed; Guardian asks for CI/CD review but does not automatically treat it as a code blocker.
- A migration changed without DB test evidence; Guardian raises release and QA risk.

## Troubleshooting

### `fatal: bad revision 'origin/main...HEAD'`

This means Git cannot resolve the configured comparison ref in the target repository. It often happens in local repositories with no `origin/main` remote-tracking branch, repositories using a different default branch, or shallow CI checkouts.

Guardian validates the requested base ref before diffing. If `--base` is invalid, it falls back to `HEAD~1` when available and prints a warning. If no base is provided, Guardian tries `origin/main`, then `main`, then `master`, then `HEAD~1`.

Useful alternatives:

```bash
npx ai-project-guardian@latest --repo . --base HEAD~1
git fetch origin main
git branch -a
```

### Local Changed Files Vs CI

When you run Guardian locally, changed-file detection combines committed branch changes with staged, unstaged, and untracked files. This lets you review work in progress before committing.

In CI, Guardian normally runs on a clean checkout and reports the committed pull request diff against the configured base ref.

## Risk Baseline

Add `.guardian-baseline.json` to accept known findings without counting them toward the active score:

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

Accepted findings are matched by `type` and `title`. They still appear under `Accepted Findings`, but only new active findings affect the score.

## Analyzer Accuracy Baseline

The repository includes integration fixtures under `tests/test-fixtures/analyzer-accuracy/` for:

- Auth changes without tests.
- Migration changes without DB tests.
- Workflow changes.
- Hardcoded secrets.
- Docs-only changes.
- Config-only changes.

These tests measure analyzer behavior before new analyzer features are added.

## Roadmap

- Configurable ignore patterns.
- Better framework-specific QA suggestions.
- Python/FastAPI calibration.
- Monorepo calibration.
- Repo Context Center integration.
- Broader real-repo calibration before stricter release gates.
