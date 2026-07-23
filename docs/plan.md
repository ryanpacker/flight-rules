# Flight Rules v2 -- build plan

Drafted 2026-07-18. This document is the handoff bridge between planning and
build sessions: a new session in this repo should be able to work from this
file alone.

## Vision

A live coordination plane for AI-assisted, multi-agent development. The core
inversion from v1: instead of every status check re-deriving the state of
parallel work from scratch (worktree metadata files, git commands, PR
listings), a Convex database is the **registry of record** for flights, and
the board is just a reactive window onto it. Agents and lifecycle scripts
write to the registry at the moment things happen; humans watch the board.

Design principle: the database stores **reported observations, not
authority**. Whether a port is listening or a process is alive is inherently
local and ephemeral -- every report carries a `reportedAt`, and the UI shows
freshness explicitly. Staleness is a first-class, visible concept.

## Vocabulary

- **flight** -- one unit of parallel work: a git worktree + dedicated dev
  environment (own port, own backend deployment) + the agent session flying it.
- **tower** -- the main checkout of a consumer project.
- **ATC** -- the coordinator session that lives in the tower: releases, PR
  accounting, flight lifecycle, project questions. ATC does not do feature
  work; feature work belongs on a flight.
- **takeoff** -- create a flight (worktree + env + registry row), or un-park
  a diverted one (same row, second leg).
- **hold** -- declare a PR as the flight's landing clearance: env stays up
  for review, fuel (a TTL) starts. Only held flights auto-close from PR state.
- **resume** -- come out of holding back to active work (more work to do).
- **divert** -- park a flight: env down, branch kept, row stays on the board
  as delayed. What teardown records; never a completion.
- **land** -- a flight's clearance PR merges; the flight is done.
- **scrub** -- abandon a flight without landing it.
- **airborne** -- env up: enroute or holding. **open** -- on the board:
  enroute, holding, or diverted.
- **the board** -- the live dashboard: every flight, the tower, loose ends,
  and an activity feed.

## Settled decisions

1. **Same repo, main rebuilt from zero.** v1 preserved on the `v1` branch and
   the `v0.15.8` tag. The deployed `.flight-rules/` payloads in consumer
   projects are static files and keep working.
2. **Repo stays public.** Everything committed here must be generic. All
   project-specific configuration (repo paths, deployment names, URL
   templates, loose ends) lives in the Convex DB and `.env.local`.
3. **Local UI + cloud Convex.** The board runs as a local dev server (port
   3999); only Convex is hosted. Rationale: the board's most-used links
   (`localhost:<port>` per flight) only resolve on the developer's machine, so
   public hosting adds auth burden without adding value. Revisit if remote
   viewing is ever wanted.
4. **Shared-secret security for phase 1.** Both reads and writes require a
   secret; the deployment URL alone gets nothing. Real auth (e.g. an identity
   provider) is a later swap confined to the validation helper.
5. **Own Convex project** (created in phase 0), separate from any consumer
   project's deployments.
6. **This repo is the authoritative home for consumer-facing scripts and
   skills** (decided 2026-07-18). They live in `payload/`: session skills
   (`flight.takeoff`, `flight.land`, `flight.scrub`, `flight.report`, `atc`)
   plus generic scripts (`flight.mjs` lifecycle CLI, `report.mjs`). An
   installer copies the payload into consumer projects -- one real copy in
   the consumer's `.flight-rules/`, with tool entries (`.claude/skills/*`,
   later `.cursor/` and Codex) as relative symlinks within the consumer repo.
   The installer resolves the target path from the registry
   (`install.mjs <project-name>` -> repoPath). Editing happens here;
   consumers get updates by reinstalling. npm distribution is a later step
   (the layout is already npm-shaped, as v1 was).
7. **Payload config resolution:** payload scripts find the registry via
   `FLIGHT_RULES_*` env vars, then `.flight-rules/config.json`
   (`project` + `siteUrl`; never the secret), then the checkout's
   `.env.local`. The same scripts run unmodified from `payload/scripts/` in
   this repo and `.flight-rules/scripts/` in a consumer.
8. **Versioning:** `2.0.0-alpha.N`, bumped when the payload changes; the
   installer stamps `.flight-rules/VERSION` in consumers. `2.0.0` is cut when
   phase 2's exit bar is met (lifecycle hooks live in the first consumer,
   status command cut over).
9. **Flight lifecycle decoupled from env lifecycle** (decided 2026-07-23,
   shipped in 2.2.0). Five stored states -- `enroute` (renamed from
   `airborne`), `holding`, `diverted`, `landed`, `scrubbed` -- per
   `docs/proposals/flight-lifecycle-holding-diverting.md` as revised in
   review: teardown records a divert (scrub only on `--delete-branch`), only
   holding flights auto-close from PR state (multi-PR enroute flights are
   first-class; merges there are just `pr-merged` events), takeoff un-parks a
   diverted flight, `resume` means holding → enroute, and hold labels are
   derived at render time along two axes (flight-readiness from PR sync,
   destination-readiness from tower + PR queue). The registry never flips
   state on a timer; a consumer-side reconciler downs envs whose flight is no
   longer enroute | holding. Full interface: `docs/lifecycle-contract.md`.

## Schema (phase 1)

All tables project-scoped from day one; the first consumer is one row in
`projects`.

- `projects` -- name, repoPath, worktreeRoot, githubRepo (`owner/name`),
  prodUrl, and URL templates for link derivation.
- `flights` -- projectId, slug, worktreePath, branch, port, deploymentName,
  status (`enroute` / `holding` / `diverted` / `landed` / `scrubbed`; the
  active state was named `airborne` until 2.2.0), createdAt / closedAt,
  holding fields (heldAt, fuelDeadline, clearancePr), divert fields
  (divertedAt, divertReason), and a `report` snapshot: reportedAt, listening
  (bool), processes (name → alive/dead), dirtyCount, ahead/behind vs the
  integration branch, last commits (sha + subject), prNumber.
- `towers` -- one row per project: branch, dirtyCount, unpushedCount, dev
  version, prod version, reportedAt; plus the tower's own dev environment
  (port, deploymentName, listening, processes -- observed the same way a
  flight's is, from `.env.local` in the main checkout) and behindUpstream
  (commits the checkout lags origin, i.e. merged-but-not-pulled work).
- `prs` -- projectId, number, title, headRef, state, isDraft, updatedAt,
  reviewDecision, checksState. Joined to flights by clearance PR, then
  reported PR, then branch.
- `looseEnds` -- projectId, text, source attribution, createdAt, resolvedAt.
- `events` -- projectId, append-only: kind (takeoff, hold, resume, divert,
  landing, scrub, pr-opened, pr-merged, release, ...), payload, at. Feeds the
  activity feed.

**Link derivation rule:** store raw identifiers (port, deployment name, PR
number, branch); derive URLs in the UI from the project row's templates
(port → `http://localhost:{port}`, deployment → the backend dashboard,
PR/branch → GitHub). Everything clickable falls out of this rule -- nothing is
hand-wired per field.

## Security model (phase 1)

A `FLIGHT_RULES_SECRET` env var set on the Convex deployment
(`npx convex env set FLIGHT_RULES_SECRET ...`). Every public query and
mutation takes a `secret` arg and rejects on mismatch -- one shared validation
helper. Shell reporters call a Convex **HTTP action** with the secret as a
bearer token. The board reads the secret from `.env.local`
(`VITE_FLIGHT_RULES_SECRET`). Not real auth; deliberately minimal, and
designed so swapping in real auth later only touches the helper.

## Phases

### Phase 0 -- bootstrap (DONE)

- `v1` branch + `v0.15.8` tag pushed; main cleared.
- Scaffold: TanStack Start + Convex + Tailwind, pnpm, port 3999.
- Convex project created; `.env.local` wired.
- This plan committed.

### Phase 1 -- registry, secret, board, one-shot reporter

1. Schema above, with the shared-secret helper on every function.
2. The board: one page -- a card per flight (health dot, branch position,
   dirty count, port, deployment, PR), a tower card, loose ends, activity
   feed. Every identifier a link per the derivation rule. Freshness badge per
   card from `reportedAt`, aging visibly.
3. `scripts/report.mjs` -- a one-shot reporter that gathers a project's state
   (worktree metadata, git ahead/behind + dirty, PR list, port/process
   liveness) and POSTs a snapshot to the HTTP action. Project config comes
   from the registry, not from anything committed here.
4. Seed the first consumer project's row and run the reporter for real.

**Exit criteria:** the board renders the first project's real flights with
working links; re-running the reporter updates the page live with no refresh;
requests without the secret are rejected for both reads and writes.

### Phase 2.5 -- absorb the flight driver (decided 2026-07-19, DONE 2026-07-19)

Flight Rules owns the *shape* of a flight; consumers provide identity
(registry row + `flightrules.config.json`) and a hangar contract (hooks).
The generic spec-1.1 driver (`wt.sh` + `lib.sh` + tests) moved from the
first consumer into `payload/scripts/`, registry calls became driver
behavior (takeoff on worktree creation, deployment patched in when a hook
reports one via `meta/deployment`, land/scrub + reporter on teardown --
all best-effort, never blocking env work), `wt-quick.sh` died at parity,
and the reporter's env-var greps come from the consumer's
`flightrules.config.json` (`report.portVar` / `deploymentVar` /
`deploymentStripPrefix`). Full brief: `docs/phase-2.5-driver.md`.

**Flight archetype #1 (the only supported shape):** a git worktree off the
integration branch + a leased port (slot = portBase + N) + a supervised dev
server + an optional per-flight backend deployment, driven by `wt.sh` and
provisioned by the consumer's hooks. Archetype #2 waits for a real project
that strains this one -- no speculative generality before then.

### Phase 2 -- instrumentation (DONE 2026-07-19; exit bar met, 2.0.0 cut)

Exit bar verified by a live shakedown flight in the first consumer
(2026-07-19): full takeoff (deployment created, name patched into the
registry row, reporter, board live), scrub (claim released, process tree
killed, event pair recorded), and landing proven by real use (a flight
landed via its merged PR earlier the same day).

1. **Lifecycle hooks:** takeoff / land / scrub wrap the consumer project's
   worktree scripts and post their own mutations at the moment of truth (they
   already know slug/port/deployment when it happens). *Done via phase 2.5:
   registry recording is driver behavior; driver installed and live in the
   first consumer.*
2. **Command cutover in the consumer project:** its status command stops
   generating static output entirely -- it runs the reporter and prints the
   board link. Session commands adopt the flight vocabulary
   (`/flight.takeoff`, `/flight.land`, `/flight.scrub`, `/atc`,
   `/flight.report`). *Done 2026-07-18: legacy status/create/remove commands
   deleted, coordinator command slimmed to project-side ground rules.*
3. **Heartbeat: dropped from scope (2026-07-19).** No cron/launchd daemon --
   skill-driven writes at lifecycle moments plus on-demand reporter runs keep
   the board fresh enough, and staleness is visible by design. If away-from-
   keyboard freshness is ever wanted, the candidate shape is the ATC session
   keeping a recurring reporter loop while on duty (dies with the session, no
   machine-level install).
4. **Later:** a real watcher daemon (consumer projects may have their own
   watcher designs -- align them with this schema rather than diverging), and
   migration of the v1 conventions machinery into v2.

## Open items

- Exact command-name spellings for the phase 2 cutover.
- Whether `looseEnds` grows into a real cross-session task surface (likely,
  but not phase 1).
- Real auth, remote hosting, and multi-machine reporting -- all explicitly
  deferred.
