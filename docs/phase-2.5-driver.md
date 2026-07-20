# Phase 2.5 — absorb the flight driver (completed 2026-07-19)

Archived brief for the phase-2.5 build. Scrubbed for the public repo:
consumer-identifying details (paths, slugs, port values, provider names)
live in the registry and the consumer's own repo, never here. Kept because
the gates and landmines remain useful reference for future driver work.

## The principle (apply it to every file)

- **Shape → FR:** worktree off the integration branch, port-slot claiming,
  hook dispatch, PID supervision, safe teardown, registry calls, staleness.
- **App → consumer:** auth-provider identity, seeds, deploy keys, env
  allowlists, smoke-probe details, port-range *values*, machine paths.
  These live in the consumer's hooks dir and `flightrules.config.json`,
  never in FR's git (this repo is public).

## The steps, with gates (all passed)

1. **Port the driver into the payload** (`payload/scripts/wt.sh` +
   `wt/lib.sh`, tests into this repo's vitest; renaming into flight
   vocabulary deferred as a separate change). *Gate: `pnpm test` green;
   the deletion test still enforces driver genericity.*
2. **Registry calls become driver behavior** — takeoff the moment the
   worktree exists, deployment patched in when a hook writes
   `$FR_CLAIM_DIR/meta/deployment`, land (merged-PR check) or scrub on
   teardown, reporter after every lifecycle change. Best-effort: registry
   failures warn and never block env work. *Gate: typecheck + tests green.*
3. **Installer ships the driver** (tests filtered out of consumer copies);
   payload version bumped; consumer reinstalled.
4. **Prove parity in the consumer**: one full up/down cycle through the
   installed driver, verified on the live board (row appears, goes
   LISTENING with correct links, exits with the right closing event). Only
   then: delete the consumer's temporary monolith and repoint its docs.
5. **De-fictionalize the reporter**: the env-var names it reads from
   worktree `.env.local` files come from the consumer's
   `flightrules.config.json` `report` block (`portVar`, `deploymentVar`,
   `deploymentStripPrefix`) — naming a backend env var names the provider,
   so there is no default for it. Archetype #1 named in plan.md.

## Operational landmines (generic; all discovered the hard way)

- **Detached-server pipe hang:** `nohup`'d server wrappers hold the
  script's stdout pipe open. Never run an `up` through a pipe from an
  agent Bash tool — redirect to a log file and poll it.
- **Live flights are off-limits:** never edit, kill, or tear down a
  worktree you didn't create; ports come from a shared, limited range.
- **Digit-suffixed test slugs are deliberate:** a slug matching the
  `word-word-number` shape regression-tests the deployment-name parse bug
  (2026-07-18), where the slug itself was grabbed as the deployment name.
- **Consumers may gate commits in their main checkout** (coordinator-only
  hooks); use the consumer's documented escape hatch, with authorization.
- Tear down any test flights you create, then run the reporter.
- The registry secret comes from `.env.local` — never commit or print it.

## Outcome

Driver + tests live in `payload/scripts/`; lifecycle recording is driver
behavior; the consumer's temporary monolith is deleted; the reporter reads
env-var names from consumer config. Deferred: flight-vocabulary renames of
the driver files; the consumer's bug-pipeline flows still owed a live
re-run per its own mileage ledger.
