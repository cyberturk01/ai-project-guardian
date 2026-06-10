# Task Routing

Use this before scanning the repository. Start with the narrowest matching row.

| Task type | Inspect first | Focused verification |
| --- | --- | --- |
| CLI argument parsing | `src/cli/runGuardian.ts`, `tests/cliArgs.test.ts` | `npm run build`, `node --test dist/tests/cliArgs.test.js` |
| Configuration loading/validation | `src/config/loadConfig.ts`, `src/config/guardianConfig.ts`, `tests/config.test.ts` | `npm run build`, `node --test dist/tests/config.test.js` |
| Repository scanning | `src/repo/getChangedFiles.ts`, `src/repo/listRepoFiles.ts`, `src/repo/fileClassifier.ts`, `tests/getChangedFiles.test.ts`, `tests/fileClassifier.test.ts` | `npm run build`, targeted repo test |
| Risk rule evaluation | `src/core/guardian.ts`, `src/analyzers/`, `src/core/baseline.ts`, matching analyzer tests | `npm run build`, targeted analyzer test |
| Report generation | `src/renderers/`, `tests/markdownReport.test.ts`, `tests/prComment.test.ts`, `tests/__snapshots__/guardian-report.md` | `npm run build`, targeted renderer test |
| Test fixtures | `tests/fixtures/`, `tests/__snapshots__/`, related `tests/*.test.ts` | Targeted test that consumes the fixture |
| Context docs / agent workflow | `AGENTS.md`, `docs/ai-context/`; use `.project-brain/metrics/` for routing metrics work | `npm run build`, `npm run lint`, `npm test` when requested |
