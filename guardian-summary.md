# AI Project Guardian Summary

| Field | Value |
| --- | --- |
| Project | ai-project-guardian |
| Generated | 2026-06-16T09:26:51.569Z |
| Merge recommendation | review_required |
| Blocking findings | 1 |
| Checklist findings | 2 |
| Code risk | **medium** |
| Release checklist risk | **high** |
| Overall/combined risk | **low** |
| Risk score | 40/100 |
| Risk reason | 1 blocking finding(s) require review before merge. Code risk: medium. Current overall risk remains low. |
| Changed files | 59 |
| External scanner findings | 0 |
| Multi-tool correlations | 0 |
| Required deploy actions | 6 |
| Actionable guidance items | 16 |
| Accepted findings | 0 |

Merge requires review because 1 code/test/security finding(s) need attention before merge.

## Findings

- QA: 1
- Release: 2
- Security: 10
- Workflow: 0
- External scanners: 0



## Required Deploy Actions

- [ ] Run install, build, and test checks from a clean dependency install.
- [ ] Review dependency diff for major upgrades or new runtime packages.
- [ ] Run dependency audit or equivalent security scanning.
- [ ] Review workflow triggers, permissions, environments, and secrets usage.
- [ ] Confirm required checks still run before deployment.
- 1 more action(s) in the full report.



## Notes

- Run with `--full-report` for changed files, detailed findings, accepted findings, and suggested tests.
- Tip: Run `npx ai-project-guardian init` to generate config, Project Brain templates, and GitHub Actions workflow.
- guardian.config.json was not found; using default config for project "ai-project-guardian".
- Local working tree changes were included in changed-file detection.
- Project Brain context is incomplete; missing files: project.md, architecture.md, testing-strategy.md, deployment-rules.md, security-rules.md, known-risks.md, known-bugs.md, module-map.json.
