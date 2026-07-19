#!/usr/bin/env bash
# ============================================================================
# Flight driver (spec 1.1) — generic dispatcher, owned by Flight Rules.
#
# GENERIC ONLY: this file and wt/lib.sh contain no project- or
# provider-specific logic; that all lives in the consumer's hooks dir named
# by flightrules.config.json. The deletion test
# (payload/scripts/__tests__/wt-driver.test.ts in the flight-rules repo)
# enforces this. If a change here needs an app or provider word, it belongs
# in a hook instead.
#
# Registry recording is the driver's own behavior (best-effort, via the
# sibling payload scripts flight.mjs / report.mjs when they are installed
# next to this file): takeoff is recorded the moment the worktree exists,
# the backend deployment name is patched in when a hook reports one by
# writing $FR_CLAIM_DIR/meta/deployment, land/scrub is recorded on
# down/prune/reap (land if the branch's PR merged, scrub otherwise), and
# the reporter runs after every lifecycle change. Registry failures warn
# and never block environment work.
# ============================================================================
set -euo pipefail

FR_SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=wt/lib.sh
source "$FR_SELF_DIR/wt/lib.sh"

usage() {
  cat >&2 <<'EOF'
usage:
  wt.sh up <slug> [--flag[=value]...]   create or resume an environment
  wt.sh down <slug> [--pr] [--force] [--delete-branch]
  wt.sh status [--json]                 list claims; reconcile stale ones
  wt.sh smoke <slug>                    re-run the readiness hook
  wt.sh prune <slug>                    release a claim whose worktree is gone
  wt.sh reap <slug>                     interactive-only immediate deletion

Unrecognized --flags on up/down are passed to hooks as FR_OPT_<NAME>.
Hook points: post-create, pre-ready, pre-finish, pre-remove, post-remove,
reap. Hooks receive FR_SLUG, FR_BRANCH, FR_BASE_SHA, FR_WORKTREE_PATH,
FR_MAIN_PATH, FR_SLOT, FR_PORT, FR_CLAIM_DIR, FR_NONINTERACTIVE, FR_OPT_*.
EOF
  exit 1
}

fr_export_opts() { # unrecognized --flags -> exported FR_OPT_<NAME>
  local a k v
  for a in "$@"; do
    [[ $a == --* ]] || fr_die "unexpected argument: $a"
    a=${a#--}
    if [[ $a == *=* ]]; then k=${a%%=*}; v=${a#*=}; else k=$a; v=1; fi
    k=$(printf '%s' "$k" | tr '[:lower:]-' '[:upper:]_')
    export "FR_OPT_$k=$v"
  done
}

# --- up ---------------------------------------------------------------------
cmd_up() {
  local slug=${1:-}; shift || true
  [[ $slug =~ ^[a-z0-9][a-z0-9-]*$ ]] || fr_die "slug must be kebab-case: '$slug'"
  fr_export_opts "$@"

  local slot
  if slot=$(fr_claim_find "$slug"); then
    fr_log "existing claim for $slug — resuming slot $slot"
  else
    [[ -d "$FR_WT_ROOT/$slug" ]] && fr_die \
      "$FR_WT_ROOT/$slug exists but has no claim — remove it (or pick another slug)"
    slot=$(fr_claim_new "$slug") || fr_die "no free slot (max $FR_MAX_SLOTS)"
    fr_log "claimed slot $slot (port $((FR_PORT_BASE + slot))) for $slug"
  fi

  local port wt alive
  port=$(fr_claim_get "$slot" port)
  wt="$FR_WT_ROOT/$slug"

  # Port-owner diagnosis only — the tool never kills what it did not record.
  alive=$(fr_pids_counts "$slot" | cut -d' ' -f1)
  if fr_port_busy "$port" && [[ $alive == 0 ]]; then
    fr_warn "port $port has a listener this tool did not record:"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    if [[ $FR_NONINTERACTIVE == 1 ]]; then
      fr_claim_set "$slot" status conflict
      fr_die "unattended run — resolve the conflict and re-run up"
    fi
    printf 'continue anyway? [y/N] '
    local a; read -r a
    [[ $a == y* ]] || fr_die "aborted"
  fi

  [[ -d $wt ]] || fr_worktree_add "$slot"

  fr_claim_set "$slot" status provisioning
  if ! fr_hook post-create "$slot"; then
    fr_claim_set "$slot" status failed-post-create
    fr_die "post-create failed — fix the cause and re-run up (hooks resume)"
  fi

  fr_claim_set "$slot" status verifying
  if ! fr_hook pre-ready "$slot"; then
    fr_claim_set "$slot" status not-ready
    fr_die "environment is NOT ready (pre-ready failed); nothing torn down — re-run 'up' or 'smoke' after fixing"
  fi

  fr_claim_set "$slot" status ready
  fr_log "READY: slug=$slug slot=$slot port=$port path=$wt"
}

# --- down -------------------------------------------------------------------
cmd_down() {
  local slug=${1:-}; shift || true
  [[ -n $slug ]] || usage
  local pr=0 force=0 delete_branch=0 rest=()
  local a
  for a in "$@"; do
    case $a in
      --pr) pr=1;;
      --force) force=1;;
      --delete-branch) delete_branch=1;;
      *) rest+=("$a");;
    esac
  done
  fr_export_opts ${rest[@]+"${rest[@]}"}

  local slot
  slot=$(fr_claim_find "$slug") || fr_die "no claim for '$slug' (wt.sh status)"
  local wt branch pr_url=""
  wt=$(fr_claim_get "$slot" worktree)
  branch=$(fr_claim_get "$slot" branch)

  if [[ -n $wt && -d $wt ]]; then
    local dirty
    dirty=$(git -C "$wt" status --porcelain | wc -l | tr -d ' ')
    if [[ $dirty -gt 0 ]]; then
      if [[ $force -eq 1 ]]; then
        [[ $FR_NONINTERACTIVE == 1 ]] && fr_die "--force on a dirty tree requires an interactive run"
        printf 'worktree has %s dirty files. Type the slug to confirm destruction: ' "$dirty"
        local confirm; read -r confirm
        [[ $confirm == "$slug" ]] || fr_die "confirmation mismatch — nothing removed"
      else
        fr_die "$dirty uncommitted changes in $wt — commit first, or --force"
      fi
    fi

    if [[ $pr -eq 1 ]]; then
      if ! fr_hook pre-finish "$slot"; then
        fr_claim_set "$slot" status gates-failed
        fr_die "pre-finish gates failed — nothing pushed, nothing torn down"
      fi
      fr_log "pushing $branch"
      git -C "$wt" push -u origin "$branch" \
        || fr_die "push failed — environment left intact"
      fr_log "opening PR against $FR_BASE_BRANCH"
      pr_url=$(cd "$wt" && gh pr create --base "$FR_BASE_BRANCH" --head "$branch" --fill) \
        || fr_die "PR creation failed — environment left intact"
      fr_claim_set "$slot" prUrl "$pr_url"
      fr_log "PR recorded: $pr_url"
    fi
  elif [[ $pr -eq 1 ]]; then
    fr_die "--pr needs the worktree, but it is gone — use prune"
  fi

  if ! fr_hook pre-remove "$slot"; then
    fr_claim_set "$slot" status cleanup_pending
    fr_die "pre-remove failed — claim marked cleanup_pending, worktree left intact"
  fi

  [[ -n $wt ]] && fr_worktree_remove "$wt"

  if [[ $delete_branch -eq 1 ]]; then
    git -C "$FR_MAIN_PATH" branch -D "$branch" >/dev/null 2>&1 \
      && fr_log "branch $branch deleted" \
      || fr_warn "could not delete branch $branch"
  else
    fr_log "branch $branch kept"
  fi

  if ! fr_hook post-remove "$slot" "$FR_MAIN_PATH"; then
    fr_die "post-remove failed — claim retained for inspection"
  fi
  fr_claim_release "$slot"
  [[ -n $pr_url ]] && fr_log "published: $pr_url"
  fr_log "done — slot $slot released"
}

# --- prune (claim whose worktree is gone, or leftover recorded processes) ---
cmd_prune() {
  local slug=${1:-}; [[ -n $slug ]] || usage
  local slot
  slot=$(fr_claim_find "$slug") || fr_die "no claim for '$slug'"
  local wt
  wt=$(fr_claim_get "$slot" worktree)
  if ! fr_hook pre-remove "$slot"; then
    fr_claim_set "$slot" status cleanup_pending
    fr_die "pre-remove failed — claim marked cleanup_pending"
  fi
  [[ -n $wt ]] && fr_worktree_remove "$wt"
  if ! fr_hook post-remove "$slot" "$FR_MAIN_PATH"; then
    fr_die "post-remove failed — claim retained for inspection"
  fi
  fr_claim_release "$slot"
  fr_log "pruned — slot $slot released"
}

# --- status -----------------------------------------------------------------
cmd_status() {
  local json=0
  [[ ${1:-} == --json ]] && json=1
  local d slot slug port st branch wt present dirty counts alive total stale notes f rows=""
  local stale_slugs=""
  for d in "$FR_CLAIMS"/slot-*; do
    [[ -f $d/claim.json ]] || continue
    slot=$(basename "$d" | sed 's/^slot-//')
    slug=$(fr_claim_get "$slot" slug)
    port=$(fr_claim_get "$slot" port)
    st=$(fr_claim_get "$slot" status)
    branch=$(fr_claim_get "$slot" branch)
    wt=$(fr_claim_get "$slot" worktree)
    present=no; dirty=-
    if [[ -n $wt && -d $wt ]]; then
      present=yes
      dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    fi
    counts=$(fr_pids_counts "$slot")
    alive=${counts%% *}; total=${counts##* }
    stale=false
    [[ -n $wt && ! -d $wt ]] && { stale=true; stale_slugs="$stale_slugs $slug"; }
    notes=""
    for f in "$d"/meta/*; do
      [[ -f $f ]] && notes="$notes$(basename "$f")=$(cat "$f") "
    done
    if [[ $json -eq 1 ]]; then
      rows="$rows$(jq -n --argjson slot "$slot" --arg slug "$slug" --argjson port "$port" \
        --arg status "$st" --arg branch "$branch" --arg worktree "$wt" \
        --argjson present "$([[ $present == yes ]] && echo true || echo false)" \
        --arg dirty "$dirty" --argjson pidsAlive "$alive" --argjson pidsTotal "$total" \
        --argjson stale "$stale" --arg notes "$notes" \
        '{slot:$slot, slug:$slug, port:$port, status:$status, branch:$branch,
          worktree:$worktree, worktreePresent:$present, dirty:$dirty,
          pidsAlive:$pidsAlive, pidsTotal:$pidsTotal, stale:$stale, notes:$notes}')"
    else
      [[ -n $rows ]] || { rows=$(printf '%-5s %-18s %-6s %-14s %-8s %-6s %-5s %s' SLOT SLUG PORT STATUS PRESENT DIRTY PIDS NOTES)$'\n'; }
      rows="$rows$(printf '%-5s %-18s %-6s %-14s %-8s %-6s %-5s %s' \
        "$slot" "$slug" "$port" "$st" "$present" "$dirty" "$alive/$total" "$notes$([[ $stale == true ]] && echo ' [STALE]')")"$'\n'
    fi
  done
  if [[ $json -eq 1 ]]; then
    printf '%s' "$rows" | jq -s .
  else
    if [[ -n $rows ]]; then printf '%s' "$rows"; else fr_log "no claims"; fi
    # Reconciliation: a claim whose worktree is gone is offered for pruning.
    if [[ -n $stale_slugs && $FR_NONINTERACTIVE == 0 ]]; then
      local s a
      for s in $stale_slugs; do
        printf 'claim %s has no worktree — prune it (stops recorded processes, releases the slot)? [y/N] ' "$s"
        read -r a
        [[ $a == y* ]] && cmd_prune "$s"
      done
    elif [[ -n $stale_slugs ]]; then
      fr_warn "stale claims:$stale_slugs — run: wt.sh prune <slug>"
    fi
  fi
}

# --- smoke ------------------------------------------------------------------
cmd_smoke() {
  local slug=${1:-}; [[ -n $slug ]] || usage
  local slot
  slot=$(fr_claim_find "$slug") || fr_die "no claim for '$slug'"
  if fr_hook pre-ready "$slot"; then
    fr_claim_set "$slot" status ready
    fr_log "ready"
  else
    fr_claim_set "$slot" status not-ready
    fr_die "NOT ready"
  fi
}

# --- reap (interactive-only immediate deletion of backing resources) --------
cmd_reap() {
  local slug=${1:-}; shift || true
  [[ -n $slug ]] || usage
  [[ $FR_NONINTERACTIVE == 1 ]] && fr_die "reap is interactive-only"
  local delete_branch=0
  [[ ${1:-} == --delete-branch ]] && delete_branch=1
  local slot
  slot=$(fr_claim_find "$slug") || fr_die "no claim for '$slug'"
  local wt branch
  wt=$(fr_claim_get "$slot" worktree)
  branch=$(fr_claim_get "$slot" branch)
  if [[ -n $wt && -d $wt ]]; then
    local dirty
    dirty=$(git -C "$wt" status --porcelain | wc -l | tr -d ' ')
    [[ $dirty -gt 0 ]] && fr_die "$dirty uncommitted changes in $wt — commit first (reap has no --force)"
  fi
  if ! fr_hook pre-remove "$slot"; then
    fr_claim_set "$slot" status cleanup_pending
    fr_die "pre-remove failed — nothing deleted"
  fi
  if ! fr_hook reap "$slot"; then
    fr_die "reap hook failed or was aborted — processes are stopped but nothing was deleted; re-run, or use plain down"
  fi
  [[ -n $wt ]] && fr_worktree_remove "$wt"
  if [[ $delete_branch -eq 1 ]]; then
    git -C "$FR_MAIN_PATH" branch -D "$branch" >/dev/null 2>&1 || fr_warn "could not delete branch $branch"
  fi
  if ! fr_hook post-remove "$slot" "$FR_MAIN_PATH"; then
    fr_die "post-remove failed — claim retained for inspection"
  fi
  fr_claim_release "$slot"
  fr_log "reaped — slot $slot released"
}

# --- dispatch ----------------------------------------------------------------
fr_init
case "${1:-}" in
  up) shift; cmd_up "$@";;
  down) shift; cmd_down "$@";;
  status) shift; cmd_status "$@";;
  smoke) shift; cmd_smoke "$@";;
  prune) shift; cmd_prune "$@";;
  reap) shift; cmd_reap "$@";;
  *) usage;;
esac
