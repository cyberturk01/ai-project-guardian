# Agent Guide

Read this file first.

## Context Order

1. Read `docs/ai-context/COMMUNICATION_MODE.md`.
2. Read `docs/ai-context/TASK_ROUTING.md`.
3. Use `TASK_ROUTING.md` before scanning the repository.
4. Read `docs/ai-context/MODULE_INDEX.md` only when routing is missing or the task spans modules.

## Work Rules

- Verify source code before changing behavior.
- Keep changes focused on the request.
- Do not add analysis logic or routing metrics unless explicitly requested.
- Run the smallest useful verification for the change.
