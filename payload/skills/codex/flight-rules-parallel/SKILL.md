---
name: flight-rules-parallel
description: Use when the user wants to create, inspect, clean up, or remove a Flight Rules parallel session, or when a session workflow branches into git worktree management through flight-rules parallel create, status, cleanup, or remove.
metadata:
  short-description: Manage Flight Rules parallel sessions
---

# Flight Rules Parallel Sessions

Use this skill for Flight Rules worktree workflows.

## Workflow

1. Open the relevant command file in `.flight-rules/commands/` first.
2. Use `flight-rules parallel create`, `status`, `cleanup`, or `remove` as directed by the workflow.
3. Keep the user informed about the worktree path, branch name, merge strategy, and cleanup behavior.
4. In navigation instructions, refer to the user's preferred agent rather than assuming a Claude-only workflow.

## Files To Read

- `.flight-rules/commands/parallel.status.md`
- `.flight-rules/commands/parallel.cleanup.md`
- `.flight-rules/commands/dev-session.start.md`
- `.flight-rules/commands/dev-session.end.md`
- `docs/implementation/2-cli-core/2.6-parallel-sessions.md`

