---
name: flight.takeoff
description: Start a new flight — a git worktree with its own dev environment plus a registry row — for one unit of parallel work. Use when spinning up feature/agent work that should run alongside other flights instead of in the tower.
---

# Flight takeoff

A flight is one unit of parallel work: a git worktree + dedicated dev
environment (own port, own backend deployment when applicable) + the agent
session flying it. Takeoff creates all three and registers the flight so it
appears on the board.

## Steps

1. **Pick a slug.** Short kebab-case name for the work (e.g.
   `checkout-redesign`). It becomes the worktree directory name and the
   flight's identity on the board.

2. **Create the worktree and environment with this project's own tooling.**
   Flight Rules does not own this step — look for the project's worktree
   scripts or docs (often a `worktree:create`/takeoff script, or documented in
   the project's CLAUDE.md/AGENTS.md). Note what the environment got: branch
   name, absolute worktree path, dev-server port, backend deployment name.

3. **Register the flight** at the moment the environment exists:

   ```sh
   node .flight-rules/scripts/flight.mjs takeoff <slug> \
     --branch <branch> --worktree <abs-path> \
     [--port <n>] [--deployment <name>]
   ```

4. **Report**, so the new flight shows live state immediately:

   ```sh
   node .flight-rules/scripts/report.mjs
   ```

5. **Hand off.** Print the worktree path and the board link the commands
   above emitted, so the human (or the flight's agent session) knows where to
   go.

Registration is idempotent — re-running takeoff for an airborne slug updates
its row rather than duplicating it.
