# Guardian Report Decision Model

Guardian reports now separate score calculation from merge decision support.

The existing `riskScore` and `overallRisk` fields still represent the combined scoring model. They include changed files, QA findings, release findings, security findings, workflow findings, external scanner findings, and multi-tool correlations. This scoring behavior is unchanged.

The decision-support fields answer a different question: is this change blocked by code/test/security/workflow evidence, or is it safe to proceed after release checklist review?

## Fields

| Field | Meaning |
| --- | --- |
| `codeRisk` | Highest active blocking risk from QA, security, workflow, external scanner, or correlated findings. Auth/security score bands can keep code risk elevated after direct blockers clear. |
| `releaseChecklistRisk` | Highest active release finding risk. |
| `blockingFindingsCount` | Count of active QA, security, workflow, external scanner, and correlated findings. |
| `checklistFindingsCount` | Count of active release findings. |
| `mergeRecommendation` | Decision hint for PR review: `blocked`, `review_required`, `safe_after_checklist`, or `safe`. |
| `riskReason` | Short human-readable reason for the decision hint. |

## Finding Classes

Blocking findings currently include:

- QA findings
- Security findings
- Workflow findings
- External scanner findings
- Correlated findings

Checklist findings currently include:

- Release findings

Release findings stay in the report because they still matter for deployment readiness. They are separated so a dependency, workflow, migration, or deploy checklist item does not look the same as a missing test or security finding.

## Recommendations

| Recommendation | Meaning |
| --- | --- |
| `blocked` | Merge should stop until the blocking condition is fixed or explicitly accepted. High/critical blocking findings and auth/security critical-floor conditions use this recommendation. |
| `review_required` | A blocking finding exists, but it is lower severity or the combined score still needs human review. |
| `safe_after_checklist` | No blocking findings remain, but release checklist items still need human approval before deploy. |
| `safe` | No blocking findings and no release checklist items remain. |

## Examples

### Auth Changed Without Negative Tests

When auth or security-sensitive code changes without negative-path test coverage, Guardian creates a blocking QA finding and applies the existing critical-floor scoring rule.

Expected decision fields:

```json
{
  "mergeRecommendation": "blocked",
  "blockingFindingsCount": 1,
  "checklistFindingsCount": 0,
  "riskReason": "Auth/security-sensitive files changed with no related test signal; negative-path coverage was not confirmed."
}
```

### Auth Changed With Negative Tests, Only Release Checklist Remains

When negative-path coverage exists and no blocking QA/security/workflow findings remain, release findings are treated as checklist work.

Expected decision fields:

```json
{
  "mergeRecommendation": "safe_after_checklist",
  "blockingFindingsCount": 0,
  "checklistFindingsCount": 1,
  "riskReason": "Only release checklist items remain."
}
```

The checklist still needs a human owner before deploy. The point is that it is no longer represented as a merge-blocking code/test/security finding.

### Real Secret Or Security Finding

When Guardian or an imported scanner detects a real secret/security finding, it remains a blocking finding even if tests exist.

Expected decision fields for high or critical security risk:

```json
{
  "mergeRecommendation": "blocked",
  "blockingFindingsCount": 1,
  "riskReason": "Security findings require review."
}
```

Lower-severity blocking findings can use `review_required`, but they still count as blocking findings until reviewed, fixed, or accepted through the baseline.

## CI Usage

`--fail-on` still uses `overallRisk`; this decision model does not change scoring or exit-code behavior by itself. Teams can read `mergeRecommendation` from JSON output or use the Markdown summary to decide whether a PR is blocked, needs review, or can proceed after checklist review.
