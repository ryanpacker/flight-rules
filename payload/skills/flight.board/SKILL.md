---
name: flight.board
description: Refresh and open the Flight Rules board — the live dashboard of this project's flights, tower, loose ends, and activity. Use when asked for project status, what's flying, or "the board".
---

# The board

The board is the live status surface for this project. Status questions are
answered by refreshing the registry and pointing at the board — not by
generating static status output.

## Steps

1. **Report** current state to the registry:

   ```sh
   node .flight-rules/scripts/report.mjs
   ```

2. **Print the board link** the reporter emits
   (`http://localhost:3999/p/<project>`). That page updates live; it does not
   need re-running after changes — only the reporter does.

3. If the link doesn't respond, the board's dev server isn't running. It runs
   from the flight-rules checkout (not from this project): `pnpm dev` there
   serves the board on port 3999.

For a quick textual answer, the reporter's own stdout summarizes tower and
flights — quote it rather than re-deriving state from git.
