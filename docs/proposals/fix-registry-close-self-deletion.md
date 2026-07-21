# Prompt: fix silent registry-close no-op when `wt.sh down` runs from inside the worktree

Copy everything below into a Flight Rules session as a single prompt.

---

Fix a silent-failure bug in the payload driver, found live in the first consumer
on 2026-07-20 (a bug-pipeline flight, PR #33): a flight's registry row stayed
"airborne" on the board forever even though the worktree, env, and branch were
all torn down correctly.

## Root cause

The payload is copied into every consumer worktree, so at teardown time two
identical copies of the driver exist: the hub checkout's and the worktree's own.
`payload/scripts/wt.sh` resolves its sibling registry scripts via
`FR_SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)` -- the directory of
whichever copy was invoked.

Inside `wt.sh down`, the order is: worktree removal (`fr_worktree_remove`) runs
BEFORE the registry close (`fr_registry_close`). When an agent runs teardown from
inside the worktree (`cd <worktree> && scripts/bug-env.sh down <slug>` -- which
the consumer's bug pipeline did), the worktree's own driver copy executes,
`git worktree remove` deletes that copy's `flight.mjs`, and then
`fr_registry` in `payload/scripts/wt/lib.sh` hits its missing-script branch:

```bash
fr_registry() { # <script.mjs> [args...]
  local script="$FR_SELF_DIR/$1"; shift
  [[ -f $script ]] || return 0          # <-- silent no-op; the close is lost
  ...
}
```

That branch exists so consumers without the registry scripts installed still work,
but here it swallows a real failure: no scrub/land is recorded, no warning is
printed, `down` finishes reporting success, and the board row is stuck airborne.
The same applies to the `fr_registry_report` call at the end of `down`.

Everything else in teardown is unaffected (bash has already parsed the shell
functions into memory, and the claim dir lives under the hub) -- only the node
script invocations lose their target file.

## The fix

In `fr_registry` (payload/scripts/wt/lib.sh:164), fall back to the hub checkout's
copy of the script when the self-copy is missing:

```bash
fr_registry() { # <script.mjs> [args...]
  local script="$FR_SELF_DIR/$1"; shift
  [[ -f $script ]] || script="$FR_MAIN_PATH/.flight-rules/scripts/${script##*/}"
  [[ -f $script ]] || return 0
  command -v node >/dev/null 2>&1 || return 0
  (cd "$FR_MAIN_PATH" && node "$script" "$@") \
    || fr_warn "registry: ${script##*/} failed (continuing)"
}
```

`FR_MAIN_PATH` is already resolved by the driver for git/gh calls. The genuine
"registry not installed" case still no-ops (neither copy exists). Do NOT fix this
by reordering `down` to close the registry before removal -- that would record the
flight as closed before teardown has actually succeeded.

One subtlety to verify: when run from the FR repo itself the payload lives at
`payload/scripts/`, not `.flight-rules/scripts/` -- make the fallback path correct
for installed consumers (that is the case that matters; if you can cheaply derive
the fallback from where the hub actually has the scripts rather than hardcoding
`.flight-rules/scripts/`, prefer that).

## Acceptance

1. Regression test in `payload/scripts/__tests__/wt-driver.test.ts`: run `down`
   via the worktree's own copy of the driver (cwd inside the worktree) and assert
   the registry close call still fires (existing tests presumably stub the
   registry endpoint -- follow their pattern).
2. Existing driver tests stay green.
3. Bump/ship per the repo's payload release process so consumers pick it up; note
   the consumer's vendored copy at `.flight-rules/scripts/` needs the payload
   update to actually get the fix.

For reference, the stale row was repaired manually with
`node .flight-rules/scripts/flight.mjs land <slug> --pr 33` from the hub, followed
by `report.mjs` -- nothing else is owed for the incident; this task is only the
durable fix.
