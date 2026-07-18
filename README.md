# Flight Rules

**v2 is being rebuilt from scratch on this branch.** Flight Rules v1 -- the
markdown conventions framework (docs, implementation specs, coding-session
workflows) -- is preserved on the [`v1` branch](../../tree/v1) and tagged
through `v0.15.8`. Projects with a deployed `.flight-rules/` directory are
unaffected; those payloads are static.

## What v2 is

Flight Rules v2 is a **live coordination plane for AI-assisted, multi-agent
development**. Where v1 gave humans and agents shared conventions on disk, v2
adds shared *state*: a real-time registry of the parallel work happening across
a project, backed by [Convex](https://convex.dev) and viewed through a locally
run [TanStack Start](https://tanstack.com/start) app called **the board**.

The vocabulary:

| Term | Meaning |
|---|---|
| **flight** | one unit of parallel work: a git worktree + its own dev environment + the agent session flying it |
| **tower** | the main checkout of a project |
| **ATC** | the coordinator session that lives in the tower -- releases, PR accounting, flight lifecycle |
| **takeoff / land / scrub** | create a flight / merge its work and tear it down / abandon it without landing |
| **the board** | the live dashboard of every flight, the tower, and loose ends |

## Status

Phase 0 (scaffold) is done. See [`docs/plan.md`](docs/plan.md) for the build
plan and current phase.

## Development

```sh
pnpm install
pnpm dev          # board on http://localhost:3999
```

Requires a Convex deployment (`npx convex dev`) and a `.env.local` with
`VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`, and `FLIGHT_RULES_SECRET` (see the
plan's security section).
