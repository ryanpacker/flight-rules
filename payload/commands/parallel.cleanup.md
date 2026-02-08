# Parallel Session Cleanup

When the user invokes "parallel cleanup", detect and clean up orphaned parallel sessions.

## Process

1. Run `flight-rules parallel cleanup` to scan for orphaned sessions
2. An orphaned session is one where the manifest entry exists but the worktree directory is missing (e.g., the user closed their terminal without running `/dev-session.end`)
3. For each orphan, the CLI will:
   - Remove the entry from the manifest
   - Delete the associated git branch
4. If no orphans are found, report that everything is clean

## When to Use

- After a crash or unexpected terminal closure during a parallel session
- If `flight-rules parallel status` shows sessions marked as orphaned
- As periodic maintenance when using parallel sessions frequently
