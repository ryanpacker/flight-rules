# Parallel Session Status

When the user invokes "parallel status", show the state of all active parallel sessions.

## Process

1. Run `flight-rules parallel status` to get the current state
2. If there are active sessions, display them clearly with navigation instructions
3. If there are orphaned sessions, suggest running `flight-rules parallel cleanup`
4. Show the main directory status (clean/dirty, current branch)

## Quick Reference

| Command | Purpose |
|---------|---------|
| `flight-rules parallel create <name>` | Start a new parallel session |
| `flight-rules parallel status` | Show this status view |
| `flight-rules parallel cleanup` | Clean up orphaned sessions |
| `flight-rules parallel remove <name>` | End a session with merge workflow |

To switch to a session, open a new terminal:
```
cd <worktree-path>
claude
```
