import type { GuardianReport } from "../core/types.js";
import {
  buildOnboardingGuidance,
  missingConfigOnboardingNote,
  missingProjectBrainOnboardingNote
} from "./onboardingGuidance.js";

export function buildMarkdownNotes(report: Pick<GuardianReport, "projectName" | "warnings">, leadingNotes: string[] = []): string[] {
  const notes = [
    ...leadingNotes,
    ...buildOnboardingGuidance(report.warnings),
    ...report.warnings.map((warning) => normalizeMarkdownWarning(warning, report.projectName))
  ];

  return dedupeNotes(notes);
}

function normalizeMarkdownWarning(warning: string, projectName: string): string {
  if (isMissingProjectBrainWarning(warning)) {
    return missingProjectBrainOnboardingNote;
  }

  if (isMissingConfigWarning(warning)) {
    return `guardian.config.json was not found; using default config for project "${projectName}".`;
  }

  return warning;
}

function dedupeNotes(notes: string[]): string[] {
  const seen = new Set<string>();
  const dedupedNotes: string[] = [];

  for (const note of notes) {
    if (seen.has(note)) {
      continue;
    }

    seen.add(note);
    dedupedNotes.push(note);
  }

  return dedupedNotes;
}

function isMissingProjectBrainWarning(warning: string): boolean {
  return warning.includes("Project Brain context was not found");
}

function isMissingConfigWarning(warning: string): boolean {
  return warning.includes("guardian.config.json was not found") && warning !== missingConfigOnboardingNote;
}
