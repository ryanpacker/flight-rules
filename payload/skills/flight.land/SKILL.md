---
name: flight.land
description: Land a flight — its work has merged; tear down the worktree/environment and close out the registry row. Use when a flight's PR has merged (or its work is otherwise integrated) and the flight is done.
---

# Flight landing

Landing means the flight's work merged into the integration branch and the
flight is being torn down. Land only when the work is actually in — if the
work is being abandoned instead, use flight.scrub.

## Steps

1. **Confirm the work is integrated.** Typically: the flight's PR is merged.
   If there are unmerged commits or dirty files in the worktree, stop and
   surface that instead of landing.

2. **Record the landing** (before teardown, while you still know the facts):

   ```sh
   node .flight-rules/scripts/flight.mjs land <slug> [--pr <n>]
   ```

   Pass `--pr` when you know the merged PR number; otherwise the registry
   falls back to the PR from the flight's last report.

3. **Tear down the worktree and environment with this project's own
   tooling** (worktree removal script, env cleanup — whatever the project
   documents).

4. **Report**, so the board reflects the new state of the world:

   ```sh
   node .flight-rules/scripts/report.mjs
   ```

5. Print the board link so the human can see the flight leave the board.
