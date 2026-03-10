---
name: flight-rules-sessions
description: Use when the user wants to start or end a Flight Rules coding session, create or update a session log, append to docs/progress.md, or follow the dev-session.start or dev-session.end workflow.
metadata:
  short-description: Run Flight Rules session workflows
---

# Flight Rules Sessions

Use this skill for requests involving:
- "start coding session" or `dev-session.start`
- "end coding session" or `dev-session.end`
- session logs in `docs/session_logs/`
- progress updates in `docs/progress.md`

## Workflow

1. Open the matching workflow file in `.flight-rules/commands/`.
2. Treat `.flight-rules/commands/` as the source of truth, even if Cursor or Claude slash-command copies also exist.
3. Follow the command file exactly, including required documentation updates and confirmation points.
4. If the workflow branches into parallel-session handling, use `flight-rules parallel ...` and tell the user to open the worktree in their preferred agent.

## Files To Read

- `.flight-rules/AGENTS.md`
- `.flight-rules/commands/dev-session.start.md`
- `.flight-rules/commands/dev-session.end.md`
- `docs/prd.md`
- `docs/implementation/overview.md`
- `docs/progress.md`

