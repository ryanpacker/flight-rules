---
name: flight.scrub
description: Scrub a flight — abandon it without landing; tear down the worktree/environment and close out the registry row with a reason. Use when a flight's work is being dropped (exploration finished, superseded, dead end).
---

# Flight scrub

Scrubbing abandons a flight without merging its work. The registry keeps the
row (status `scrubbed`) and the reason, so the board's activity feed tells the
story later.

## Steps

1. **Confirm nothing worth keeping is lost.** If the worktree has commits or
   dirty files that might matter, surface them and ask before scrubbing.

2. **Record the scrub, with a reason** — one short phrase, it appears
   verbatim in the activity feed:

   ```sh
   node .flight-rules/scripts/flight.mjs scrub <slug> --reason "exploration only"
   ```

3. **Tear down the worktree and environment with this project's own
   tooling.**

4. **Report**:

   ```sh
   node .flight-rules/scripts/report.mjs
   ```
