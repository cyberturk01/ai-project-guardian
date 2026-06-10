# Routing Report Format

Routing reports summarize local routing-session notes by `routing_row`. They are documentation artifacts only: no telemetry, no database, no SDK, and no external service.

## Metrics

- `routing_row_usage_count`: Number of sessions that used the row.
- `average_files_opened`: Average count of `opened_files` per session.
- `resolution_rate`: Resolved sessions divided by total sessions for the row.
- `extra_scan_rate`: Sessions with opened files outside `recommended_files` divided by total sessions.
- `most_common_extra_files`: Files opened often but not listed in the row recommendation.

## Report Shape

Use one object per routing row:

```json
{
  "routing_row": "CLI argument parsing",
  "usage_count": 12,
  "average_files_opened": 1.8,
  "resolution_rate": 0.92,
  "extra_scan_rate": 0.08,
  "most_common_extra_files": ["src/cli/index.ts"]
}
```

## Measuring Routing Quality

A strong row is used often, resolves tasks at a high rate, keeps `average_files_opened` low, and has a low `extra_scan_rate`.

A weak row shows repeated extra scans, low resolution, or frequent extra files that should have been recommended up front.

## Improving `TASK_ROUTING.md`

Use report patterns to make small routing edits:

- Add common extra files when they repeatedly help resolution.
- Remove recommended files that agents rarely open.
- Split a broad row when extra scans cluster around different task shapes.
- Add a fallback note when tasks span modules.
