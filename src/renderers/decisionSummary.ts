import type { GuardianReport } from "../core/types.js";

export function renderDecisionSummary(report: GuardianReport): string {
  switch (report.mergeRecommendation) {
    case "blocked":
      return `Merge blocked because ${report.blockingFindingsCount} blocking code/test/security finding(s) require attention.`;
    case "review_required":
      if (report.blockingFindingsCount === 0) {
        return "Merge requires review because non-blocking findings need human review before merge.";
      }

      return `Merge requires review because ${report.blockingFindingsCount} review-required code/test/security finding(s) need attention before merge.`;
    case "safe_after_checklist":
      return "Merge is safe after completing the remaining release checklist items.";
    case "safe":
      return "No blocking findings remain. Merge is considered safe.";
  }
}
