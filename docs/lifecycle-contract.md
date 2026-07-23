# Flight lifecycle contract

The stable interface between the Flight Rules registry and consumer projects,
as of 2.2.0 (the holding/diverted lifecycle). Consumer-side work -- drivers,
pipelines, reconcilers -- builds against this document; changes to it are
versioned with the payload.

## Vocabulary

Five stored states. Stored state changes only when real infrastructure
changes; everything richer is derived at render time.

| State | Meaning | Worktree/env |
|---|---|---|
| `enroute` | Active work | Up |
| `holding` | PR open, circling for review; the PR is the declared landing clearance | Up |
| `diverted` | Parked at the alternate -- delayed, not done | Down; branch kept |
| `landed` | PR merged | Down |
| `scrubbed` | Abandoned | Down |

Derived groupings: **airborne** = env up = `enroute | holding`.
**open** = on the board = `enroute | holding | diverted`.

Principles:

- **Teardown never decides a flight's fate.** `down` records a divert; land
  and scrub come from the PR observer (for held flights) or an explicit call.
- **Holding is the explicit declaration "this PR is my landing clearance."**
  Only holding flights are auto-closed from PR state. An enroute flight's PR
  merging is recorded as a `pr-merged` event and nothing more -- multi-PR
  flights are first-class.
- **Nothing resumes from the ground.** `takeoff` covers both a fresh start
  and un-parking a diverted flight (same row). `resume` means
  holding → enroute (more work to do). Diverted → holding is takeoff then
  hold, two calls; consumers may wrap the pair.

## CLI verbs (`flight.mjs`)

All verbs accept `--project <name>` (default: `FLIGHT_RULES_PROJECT` or
`.flight-rules/config.json`). Registry calls from the driver are best-effort:
failures warn and never block environment work.

| Verb | Args | Semantics |
|---|---|---|
| `takeoff <slug>` | `--branch` `--worktree` required; `--port` `--deployment` optional | No open flight → create `enroute` row + `takeoff` event. Diverted flight → un-park: same row back to `enroute`, divert/fuel fields cleared, `takeoff` event (second leg). Enroute/holding flight → idempotent env-field update, no event. |
| `hold <slug>` | `--pr <n>` optional (clearance PR; falls back to the reported PR, then branch match), `--fuel-hours <h>` optional | Enroute → `holding`: sets `heldAt`, `fuelDeadline = now + (flag ?? project.fuelHours ?? 8)h`, `clearancePr`; `hold` event. Already holding → idempotent refresh of fuel + clearance (no event) -- this is also how fuel is extended. Diverted → error (takeoff first). |
| `resume <slug>` | -- | Holding → `enroute` (fuel cleared, `resume` event). Already enroute → no-op success. Diverted → error (takeoff to un-park, not resume). |
| `divert <slug>` | `--reason "..."` optional | Enroute/holding → `diverted`: env is down, branch kept, row stays on the board; `divert` event. **Tolerant**: already diverted, already closed, or no flight at all → success no-op (callers divert blind at teardown). |
| `land <slug>` | `--pr <n>` optional | Any open state → `landed` + `landing` event. Already landed → no-op success (retry-safe). No flight → error. |
| `scrub <slug>` | `--reason "..."` optional | Any open state → `scrubbed` + `scrub` event. Already scrubbed → no-op success. No flight → error. |
| `status <slug>` | -- | Prints JSON: the **most recent** flight row for the slug regardless of state (`slug`, `status`, `branch`, `port`, `worktreePath`, `heldAt`, `fuelDeadline`, `clearancePr`, `divertedAt`, `divertReason`, `createdAt`, `closedAt`). `null` strictly means no flight ever existed. |
| `holding` | (no slug) | Prints JSON list of holding flights: `[{slug, branch, port, heldAt, fuelDeadline, clearancePr}]`. |

## HTTP routes

Bearer-authenticated (`Authorization: Bearer $FLIGHT_RULES_SECRET`) against
the registry site URL.

- `POST /flights/takeoff|hold|resume|divert|land|scrub` -- body
  `{projectName, slug, ...verb args}` (field names: `prNumber`, `fuelHours`,
  `reason`, `branch`, `worktreePath`, `port`, `deploymentName`).
- `GET /flights/status?project=<name>&slug=<slug>` -- see `status` above.
- `GET /flights/holding?project=<name>` -- see `holding` above.

## Events

Append-only feed kinds: `takeoff`, `hold`, `resume`, `divert`, `landing`,
`scrub`, `pr-opened`, `pr-merged`, `release`. `pr-merged` fires once per PR
on the transition to merged, whatever the flight's state.

## The PR observer

Runs inside report ingest (`POST /report`), so it observes at reporter
cadence. Scoped to the reporting project. For each **holding** flight it
resolves the clearance PR (`clearancePr` → reported PR number → newest PR
matching the branch) and, driven by current PR state (not transitions, so a
missed snapshot can't strand a flight):

- PR merged → flight `landed` (closedAt = merge time).
- PR closed unmerged → flight `scrubbed`, reason "PR closed unmerged".

Enroute and diverted flights are never auto-closed.

## The driver (`wt.sh`)

- `up` records `takeoff` the moment the worktree exists (and re-records to
  patch in a hook-reported deployment name). Un-parking is automatic: `up` on
  a slug whose branch survives reuses the branch, and the takeoff verb turns
  a diverted row back to enroute.
- `down` / `prune` / `reap` record `divert` with a reason
  (`worktree removed` / `claim pruned` / `reaped`). With `--delete-branch`
  they record `scrub` instead -- deleting the branch is the caller declaring
  abandonment. No `gh` queries at teardown.
- The reporter runs after every lifecycle change.

## The consumer reconciler

The consumer side hosts a reconciler loop (the registry never flips state on
a timer -- stored state tracks real infrastructure). Its obligations:

- **Down any live driver-created env whose flight is no longer
  `enroute | holding`.** The subsequent `down` records a divert, which the
  registry no-ops if the flight already closed.
- **Fuel expiry is one case of that rule**: a holding flight with
  `fuelDeadline < now` gets downed; the recorded reason should say fuel ran
  out (e.g. `wt.sh down` after observing expiry, or `flight.mjs divert
  --reason "fuel exhausted"` before teardown).
- **Fail safe**: act only on rows the registry returned. A transport error or
  a `null` from `/flights/status` means *skip*, never tear down. Only manage
  envs known to be driver-created -- pre-cutover envs with no registry row
  must never be reaped on a `null`.

## Fuel

- Project default: `fuelHours` on the project row (set via `POST /projects`);
  registry fallback 8h. Per-flight override: `hold --fuel-hours`.
- Re-holding refreshes the tank; `resume` and `takeoff` clear it.
- The board shows fuel remaining on every holding flight.

## Derived display labels (board-side, never stored)

Holding rows carry labels computed at render time along two independent
axes; flight-readiness takes display priority when both apply.

- **Flight-readiness** (from PR sync -- `reviewDecision`, `checksState`):
  `CHANGES_REQUESTED` or failing checks → **go-around required**; `APPROVED`
  with checks passing → **cleared to land**; otherwise → **waiting for
  clearance**.
- **Destination-readiness** (tower observation + other open PRs): tower
  checkout dirty → **runway blocked**; otherwise N-1 older open PRs ahead →
  **number N for landing**.

## Consumer to-do (first consumer, separate PR)

1. Update the vendored payload (`.flight-rules/scripts/`) to 2.2.0.
2. Pipeline teardown stage becomes conditional: outcome fixed + PR open →
   `flight.mjs hold --pr <n>` (env stays up, fuel starts); needs-info /
   unable-to-fix → `flight.mjs scrub --reason ...` then `down`. Auto-merge
   flights pass through holding briefly -- one code path.
3. Host the reconciler in the existing watcher loop, per the obligations
   above.
