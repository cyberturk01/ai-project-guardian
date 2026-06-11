import type { ReportFormat } from "../config/loadConfig.js";
import type { GuardianReport } from "../core/types.js";
import { renderMarkdownReport } from "./markdownReport.js";
import { renderMarkdownSummary } from "./markdownSummary.js";
import { renderSarifReport } from "./sarifReport.js";

export type ReportStyle = "summary" | "full";

export function renderReport(report: GuardianReport, format: ReportFormat, style: ReportStyle = "full"): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (format === "sarif") {
    return `${JSON.stringify(renderSarifReport(report), null, 2)}\n`;
  }

  if (style === "summary") {
    return renderMarkdownSummary(report);
  }

  return renderMarkdownReport(report);
}
