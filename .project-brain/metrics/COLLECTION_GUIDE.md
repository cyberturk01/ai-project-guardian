# Routing Metrics Collection Guide

Record routing sessions only when they can improve `docs/ai-context/TASK_ROUTING.md`.

## Record When

- The task starts from `TASK_ROUTING.md`.
- A routing row influenced file selection.
- More than one source or test file was inspected.
- Extra scanning was needed beyond the recommended files.

## Do Not Record When

- Typo-only edits.
- README-only edits.
- Formatting-only changes.
- Trivial single-file changes.

## Good Examples

- Accurate: recommended files were enough and the task resolved.
- Partially accurate: recommended files helped, but one or two extra files were needed.
- Failed: the row did not lead to the right area and a broad scan was needed.

## Naming

Use `YYYY-MM-DD-task-type.json`.

Example: `2026-06-10-cli-argument-parsing.json`.

## Notes

Keep session notes factual and short. Prefer concrete file names and the smallest explanation that would help improve routing.
