# Flight Rules v2 -- agent guidelines

Read `docs/plan.md` before doing anything else. It is the build plan and the
source of truth for vocabulary, schema, phasing, and settled decisions.

## Ground rules

- **This repo is public.** Never commit machine-specific paths, deployment
  names, secrets, or anything identifying a specific company's internal work.
  Project-specific configuration lives in the Convex database and `.env.local`,
  never in git.
- Package manager is **pnpm** (see `packageManager` in package.json).
- The board's dev server is pinned to **port 3999** -- don't change it; flight
  environments in consumer projects use their own port ranges.
- Keep the stack lean: TanStack Start + Convex + Tailwind. Add dependencies
  only when the plan calls for them.
- v1 (the markdown conventions framework) lives on the `v1` branch. Leave it
  untouched.
