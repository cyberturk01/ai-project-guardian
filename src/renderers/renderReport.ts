import type { ReportFormat } from "../config/loadConfig.js";
import type { GuardianReport } from "../core/types.js";
import { renderMarkdownReport } from "./markdownReport.js";

export function renderReport(report: GuardianReport, format: ReportFormat): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  return renderMarkdownReport(report);
}
