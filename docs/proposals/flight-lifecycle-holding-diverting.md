# Proposal: decouple flight lifecycle from environment lifecycle -- holding, diverting, landing

Status: proposal, not yet scheduled. Captured 2026-07-20 from consumer
feedback (the first consumer's bug auto-fix pipeline; Ryan). Extends the phase-1
schema's flight statuses (`airborne` / `landed` / `scrubbed`) with two new
stored states and inverts who decides a flight's fate.

## The use case

The first consumer's bug auto-fix pipeline runs one flight per bug: worktree +
local dev server + backend deployment, fix built and verified, PR opened.
When the pipeline's merge gate doesn't auto-merge, the PR is held for human
review -- and that review usually needs more than the diff. The reviewer
wants to open the running app and watch the fix behave, so **most PRs held
for review also need a live environment at review time**.

Today the pipeline tears the environment down immediately after opening the
PR, and the interim driver closes the flight as **scrubbed** ("worktree
removed") because the PR hasn't merged yet. Three consequences:

1. The reviewer arrives to a dead environment and rebuilds one by hand
   (with a trap: re-upping the original slug fails because the branch
   outlives the worktree and `up` blindly creates it with `-b`).
2. The board misreports live work as abandoned -- and since teardown always
   precedes merge on this path, a pipeline flight can *never* land. Every
   one reads "scrubbed" forever, even after its PR merges.
3. The flight row should be the click-through for reviewing a PR's result --
   open PR, running env URL, one click to see it working. Scrub-on-PR-open
   forecloses that permanently.

The cost argument for early teardown is weak: the backend deployment already
outlives teardown (nothing auto-cleans it; it self-expires), a local dev
server is nearly free, and the fixed port-slot cap is an artifact of the
temporary consumer script, not the design. The real concurrency limit is how
many agents run in parallel, which is governed elsewhere.

## Root cause

The current model conflates two lifecycles: **the flight** (a unit of work,
alive until merged or abandoned) and **the environment** (worktree +
processes + deployment, cheap and reproducible). Teardown currently *decides*
the flight's fate -- landed if the PR happened to merge first, scrubbed
otherwise. A plane should never leave the radar until it's at its destination
or the flight is cancelled.

## Proposed model

**Store few states, derive the rest.** The registry persists only states
that change what infrastructure exists; richer labels are computed from PR
state at report time, so the board can't drift from reality.

### Stored states

| State | Meaning | Worktree/env | Enter via | Leave via |
|---|---|---|---|---|
| **airborne** | Work in progress | Up | takeoff | hold, scrub |
| **holding** | PR open, circling for review | **Up** | PR opened without auto-merge | land, divert, scrub |
| **diverted** | Holding fuel ran out; parked at the alternate | **Down** (branch survives; deployment self-expires) | reaper or manual divert | resume, land, scrub |
| **landed** | PR merged | Down | merge observed | terminal |
| **scrubbed** | Work abandoned | Down | manual, or PR closed unmerged | terminal |

`airborne`, `landed`, `scrubbed` already exist in the phase-1 schema;
`holding` and `diverted` are new. New event kinds: `hold`, `divert`,
`resume`.

Derived display labels on `holding`, computed from PR state at report time
(the `prs` table already syncs this): **waiting for clearance** (review
requested), **cleared to land** (approved, unmerged), **go-around** (changes
requested). No storage.

### Fuel (holding TTL)

- Config knob `holding.fuelHours` on the project row, default ~8 -- hours,
  not days: a morning PR survives to end of day; nothing circles overnight.
  Optionally overridable per flight at hold time.
- The board shows fuel remaining on every holding flight, making the cost of
  live envs visible instead of hidden.
- A reaper (a consumer's existing watcher loop is a natural host; a cron
  works too) diverts any holding flight past its fuel: stop dev servers,
  remove the worktree (refuse on a dirty tree), keep the branch, leave the
  deployment to self-expire, record reason `fuel exhausted`. **The row stays
  on the board.**

### Diverted = delayed, not completed

- The row keeps the PR link and shows the resume command. Holding rows link
  to a live env; diverted rows link to the PR plus a one-command way to get
  the env back.
- **Resume is a second takeoff on the same flight number**:
  `flight.resume <slug>` re-ups the env onto the *existing* branch (fixing
  the `-b` trap -- up must branch-or-checkout, not blindly create), re-mints
  the deployment if expired, re-seeds (which also cures seed drift), and
  returns the flight to holding with a fresh tank. Same registry row, new
  leg: the activity feed reads takeoff → holding → diverted → resumed →
  landed.

### Landing and cancellation

- **Land fires on merge, never on teardown.** A merge observer lands from
  either holding (teardown is part of landing) or diverted (row just
  closes). A human merging from the diff alone lands the flight without it
  ever resuming.
- **PR closed unmerged → auto-scrub** (`PR closed unmerged`), from either
  state. Fuel bounds holding; the PR's own lifecycle bounds diverted -- no
  state is unbounded.
- **The key inversion:** teardown becomes a *consequence* of
  land/divert/scrub events. `down` never decides a flight's fate again.

### Consumer pipeline integration (first consumer)

The pipeline's teardown stage becomes conditional: outcome `fixed` + PR
open → **hold** (env stays up, fuel starts); `needs-info` /
`unable-to-fix` → scrub immediately. Auto-merge flights pass through holding
for seconds -- one code path, not two.

### Design principle to hold the line on

Resist adding stored states beyond these five, even though the metaphor
offers more (taxiing, pushback, ground stop). Every stored state is a place
the registry can disagree with reality. Holding and diverted earn their keep
because each corresponds to real infrastructure being up or down; everything
else is paint on the board.
