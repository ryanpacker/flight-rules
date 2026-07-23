# Phase 3 -- the knowledge layer

Brief for the phase-3 build. Execute alongside [plan.md](plan.md) (which owns
core-build decisions; add a phase-3 section there as step 0). Public-repo
ground rule applies throughout: everything committed here is generic --
consumer-identifying detail (names, paths, company work) stays in the
consumer's own repo and the registry.

## What this phase is

v2 so far is the coordination plane: the registry knows *what work is in
flight*. The knowledge layer is the other half of Flight Rules: the
conventions that keep a project's *documentation* useful to agents across
sessions. It was the surviving core of v1 (proven by real usage during the
2026-07-17 review of the v1 fleet) and is deliberately small -- three doc
types, a wrap ritual, and a drift checker. The first consumer already runs a
hand-built prototype of most of it (its root agent guide, windowed progress
doc, and slim session wrap); this phase generalizes that prototype into the
payload so every consumer gets it.

Guiding framing (Ryan's, from the v1 review): **the product is the ambient
doctrine a project's root guide loads into every agent session; skills are
its verbs.** Keep the doctrine small enough to be ambient.

## Deliverables

### 1. The doctrine fragment (core deliverable)

A ≤400-word block of standing guidance, shipped in the payload, embedded in a
consumer's root `CLAUDE.md` / `AGENTS.md` so every session absorbs it. It
defines:

- **Three doc types** and nothing more:
  - `docs/progress.md` -- windowed running log (+ `docs/progress-archive.md`);
    newest on top, oldest rolled to the archive past ~15 entries.
  - `docs/critical-learnings.md` -- hard-won constraints and gotchas. Append
    rarely, distill hard, every entry dated with provenance. Not a diary.
  - `docs/prd.md` -- one page, write-once orientation. Not a spec tree.
- **When to write**: orient from these docs before feature work; wrap when
  work lands (see deliverable 2). No session-start ritual, no session logs --
  git history plus the progress entry are the record.
- **The drift rule**: docs are guidance; code and git win conflicts. Flag
  drift, don't obey it.

Generalize from the first consumer's root guide (read it locally via the
registry's `repoPath`; never quote or commit consumer specifics). Draft it,
then **stop for Ryan's edit** -- the fragment is canon only after a human
pass. How consumers embed it (installer-managed block vs. copied file) is an
open design point; start with the simplest thing the installer can refresh.

### 2. The wrap (doc half of `flight.land`)

The end-of-work ritual, successor to the first consumer's session-end
command: append a progress entry, promote a learning **only if one was
earned**, then the PR flow the skill already handles. Fold it into the
`flight.land` skill (and make it invokable standalone for tower work that
lands without a flight). Retire the consumer's local version once parity is
proven.

### 3. `reconcile` (new payload skill)

The genuinely novel export from v1: diff the doctrine docs against code and
git reality, report drift, fix on approval. Concretely: stale progress
claims, learnings contradicted by current code, PRD statements about shipped
features that no longer hold, dead file references. Report first, mutate only
with consent. A `--orient` flag (reconcile + orientation summary) covers the
dormant-project-revival case; don't build a separate skill for it.

## Gates

- Doctrine fragment ships only after Ryan's human edit (hard checkpoint).
- Nothing consumer-identifying lands in this repo, ever.
- Dogfood in the first consumer before calling any deliverable done.
- Promote-before-delete: when the consumer's v1 `.flight-rules/` remnants
  (doc templates, old AGENTS.md, command copies) are finally deleted, anything
  durable in them is promoted first, and deletions follow the v1 manifest --
  never touch consumer-authored files living alongside.

## Exit bar

- The doctrine fragment exists in the payload in generic form, human-edited.
- The first consumer's root guide embeds it; its v1 payload remnants are
  deleted per manifest.
- `flight.land` performs the wrap; the consumer's legacy wrap command is
  retired.
- `reconcile` has run for real against the first consumer's docs and its
  findings were dispositioned (fixed or dismissed) by Ryan.
