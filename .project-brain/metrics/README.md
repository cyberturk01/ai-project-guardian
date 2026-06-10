# Routing Metrics

Lightweight proof of concept for checking whether `docs/ai-context/TASK_ROUTING.md` helps agents reach the right files quickly.

## Why This Exists

Routing metrics give future agents a small feedback loop. A routing session records the task type, the row used, the files recommended by that row, the files actually opened, and whether the task was resolved.

This is not telemetry. It is a local documentation pattern for manual or agent-authored notes.

## How It Improves Task Routing

Compare `recommended_files` with `opened_files` after a task:

- If agents repeatedly open extra files, the routing row may be missing an important entry.
- If agents never open a recommended file, that entry may be low value.
- If tasks remain unresolved, the task type may need a clearer row or a module fallback.

## How It Reduces Repository Scanning

Useful routing rows should lead agents to a short first-read set. Over time, session notes can show where agents still fall back to broad scans, then guide tighter `TASK_ROUTING.md` rows.

## Low-Value Row Signals

A row may need pruning or splitting when:

- Recommended files are rarely opened.
- Opened files are usually outside the recommendation.
- Notes mention unclear ownership or duplicate routing choices.
- Similar tasks resolve faster through another row.

## Usage

Copy `routing-session.example.json` into a local session note when useful. Keep entries compact and do not include secrets, private user data, or generated analytics.
