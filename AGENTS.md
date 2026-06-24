# AGENTS.md

Read this first.

## RCC Workflow

For coding tasks, first run once at task start:

`rcc work "<task>" --agent`

Then:
- Inspect the returned primaryFiles, tests, and supportingFiles before reading or searching broadly.
- Do not repeatedly run `rcc work` for the same task.
- Use `rcc find "<keyword>"` only if the route is insufficient.
- Do not ask the human to run RCC commands.
- After meaningful changes, run tests and record:
  `rcc done --summary "<summary>" --files auto --verify "<checks>"`
- Read `docs/ai-context/HANDOFF.md` if present.
- Read `docs/ai-context/WORK_INDEX.md` if task/history context is unclear; do not read full `WORK_LOG.md` by default.

## Local RCC Development

- Use `node dist/cli/index.js <command>` in this repo; run `npm run build` first after source changes.
- Use `doctor` for local/global RCC confusion.
- Use `measure` for token-saving estimates.
- Use `npm run benchmark:routing` and `npm run benchmark:work-repeat` to validate RCC behavior.
- If RCC commands are unavailable, read only `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`; check `docs/ai-context/DO_NOT_READ.md` before manual broad scans.

Keep changes focused. Avoid unnecessary repository scanning.
