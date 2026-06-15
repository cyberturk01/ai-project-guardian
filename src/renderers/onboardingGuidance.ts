export const missingConfigOnboardingNote =
  "Tip: Run `npx ai-project-guardian init` to generate config, Project Brain templates, and GitHub Actions workflow.";

export const missingProjectBrainOnboardingNote =
  "Project Brain context was not found. Add `.project-brain/` repository-specific context to improve report quality.";

export function buildOnboardingGuidance(warnings: string[]): string[] {
  const guidance: string[] = [];

  if (warnings.some((warning) => warning.includes("guardian.config.json was not found"))) {
    guidance.push(missingConfigOnboardingNote);
  }

  if (warnings.some((warning) => warning.includes("Project Brain context was not found"))) {
    guidance.push(missingProjectBrainOnboardingNote);
  }

  return guidance;
}
