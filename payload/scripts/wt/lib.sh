# Generic library for the flight driver (spec 1.1).
#
# GENERIC ONLY. The deletion test (payload/scripts/__tests__/
# wt-driver.test.ts in the flight-rules repo) rejects any project- or
# provider-specific vocabulary in this file or in wt.sh. Everything
# environment-specific lives in the consumer's hooks under the configured
# hooksDir. If a change here needs a provider word, it belongs in a hook
# instead.
#
# Sourced by wt.sh; expects FR_SELF_DIR to be set to wt.sh's directory.

fr_log() { printf '\033[1;34m[wt]\033[0m %s\n' "$*"; }
fr_warn() { printf '\033[1;33m[wt] WARN:\033[0m %s\n' "$*" >&2; }
fr_die() { printf '\033[1;31m[wt] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

fr_cfg() { # key default
  jq -r --arg k "$1" --arg d "${2:-}" 'if has($k) then .[$k] | tostring else $d end' "$FR_CONFIG"
}

fr_expand() { # ~ expansion for config paths
  case "$1" in "~"*) printf '%s\n' "$HOME${1#\~}";; *) printf '%s\n' "$1";; esac
}

fr_init() {
  # The driver, its config, and the hooks travel together in git: resolve
  # them from the checkout that contains the invoked wt.sh.
  FR_ROOT=$(git -C "$FR_SELF_DIR" rev-parse --show-toplevel 2>/dev/null) \
    || fr_die "wt.sh must live inside a git checkout"
  FR_CONFIG="$FR_ROOT/flightrules.config.json"
  [[ -f $FR_CONFIG ]] || fr_die "missing config: $FR_CONFIG"
  # The main checkout (first `git worktree list` entry) owns worktree
  # add/remove and is where post-remove runs.
  FR_MAIN_PATH=$(git -C "$FR_ROOT" worktree list --porcelain | awk '/^worktree /{print $2; exit}')
  [[ -n $FR_MAIN_PATH ]] || fr_die "could not resolve the main checkout"
  FR_BASE_BRANCH=$(fr_cfg baseBranch dev)
  FR_PORT_BASE=$(fr_cfg portBase 3100)
  FR_MAX_SLOTS=$(fr_cfg maxSlots 10)
  FR_HOOKS_DIR="$FR_ROOT/$(fr_cfg hooksDir hooks)"
  FR_WT_ROOT=$(fr_expand "$(fr_cfg worktreesRoot "$HOME/worktrees")")
  FR_COPY_ENV=$(fr_cfg copyEnvFiles false)
  FR_CLAIMS="$FR_WT_ROOT/.claims"
  # Interactive unless stdin is not a tty or the caller forces it.
  if [[ -n ${FR_NONINTERACTIVE:-} ]]; then :
  elif [[ -t 0 ]]; then FR_NONINTERACTIVE=0
  else FR_NONINTERACTIVE=1; fi
  export FR_NONINTERACTIVE
}

# ---------------------------------------------------------------------------
# Claims. A slot is a port lease: slot N -> port (portBase + N). Claiming is
# an atomic mkdir of the slot dir, done BEFORE any resource is created;
# everything learned afterwards is recorded into the claim as it comes into
# existence (record-before-mutate).
# ---------------------------------------------------------------------------

fr_claim_dir() { printf '%s\n' "$FR_CLAIMS/slot-$1"; }
fr_claim_json() { printf '%s\n' "$FR_CLAIMS/slot-$1/claim.json"; }

fr_claim_find() { # slug -> prints slot number; rc 1 if none
  local d
  for d in "$FR_CLAIMS"/slot-*; do
    [[ -f $d/claim.json ]] || continue
    if [[ $(jq -r '.slug // empty' "$d/claim.json") == "$1" ]]; then
      basename "$d" | sed 's/^slot-//'
      return 0
    fi
  done
  return 1
}

fr_claim_new() { # slug -> prints slot number; rc 1 if no slot free
  local n d
  mkdir -p "$FR_CLAIMS"
  n=1
  while [[ $n -le $FR_MAX_SLOTS ]]; do
    d=$(fr_claim_dir "$n")
    if mkdir "$d" 2>/dev/null; then
      mkdir -p "$d/logs" "$d/pids" "$d/meta" "$d/state"
      jq -n --arg slug "$1" --arg branch "$1" --argjson slot "$n" \
        --argjson port $((FR_PORT_BASE + n)) --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{slug:$slug, branch:$branch, slot:$slot, port:$port, status:"claimed", createdAt:$at}' \
        >"$d/claim.json"
      printf '%s\n' "$n"
      return 0
    fi
    n=$((n + 1))
  done
  return 1
}

fr_claim_set() { # slot key value
  local f
  f=$(fr_claim_json "$1")
  jq --arg k "$2" --arg v "$3" '.[$k]=$v' "$f" >"$f.tmp" && mv "$f.tmp" "$f"
}

fr_claim_get() { # slot key -> value or empty
  jq -r --arg k "$2" '.[$k] // empty' "$(fr_claim_json "$1")"
}

fr_claim_release() { rm -rf "$(fr_claim_dir "$1")"; }

fr_pids_counts() { # slot -> "alive total"
  local d f pid alive=0 total=0
  d="$(fr_claim_dir "$1")/pids"
  for f in "$d"/*.json; do
    [[ -f $f ]] || continue
    total=$((total + 1))
    pid=$(jq -r '.pid // empty' "$f")
    [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null && alive=$((alive + 1))
  done
  printf '%s %s\n' "$alive" "$total"
}

fr_port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# Hook dispatch. Registration is by filename in hooksDir; a missing hook is
# a no-op. Hooks run with cwd = the worktree (if it exists) unless a cwd is
# given, and receive the FR_* contract vars. FR_OPT_* pass-throughs are
# already exported by the dispatcher. Exit 0 = success; nonzero semantics
# are per hook point (see spec 1.1). Hooks must be safe to re-run — the
# retry model is "run it again".
# ---------------------------------------------------------------------------

fr_hook() { # name slot [cwd]
  local name=$1 slot=$2 cwd=${3:-} hook wt
  hook="$FR_HOOKS_DIR/$name"
  if [[ ! -e $hook ]]; then
    fr_log "hook $name: not present, skipping"
    return 0
  fi
  [[ -x $hook ]] || fr_die "hook $name exists but is not executable"
  wt=$(fr_claim_get "$slot" worktree)
  if [[ -z $cwd ]]; then
    if [[ -n $wt && -d $wt ]]; then cwd=$wt; else cwd=$FR_MAIN_PATH; fi
  fi
  fr_log "hook: $name"
  (
    cd "$cwd" || exit 1
    FR_SLUG=$(fr_claim_get "$slot" slug) \
    FR_BRANCH=$(fr_claim_get "$slot" branch) \
    FR_BASE_SHA=$(fr_claim_get "$slot" baseSha) \
    FR_WORKTREE_PATH=$wt \
    FR_MAIN_PATH=$FR_MAIN_PATH \
    FR_SLOT=$slot \
    FR_PORT=$(fr_claim_get "$slot" port) \
    FR_CLAIM_DIR=$(fr_claim_dir "$slot") \
      "$hook"
  )
}

# ---------------------------------------------------------------------------
# Worktree create / remove. Git mutations against the shared main checkout
# are serialized with a stealable lock: concurrent `up`s race for SLOTS
# atomically (mkdir claims), but fetch/worktree-add/remove contend on git's
# own internal locks and must take turns. A lock whose holder is dead is
# stolen via atomic rename.
# ---------------------------------------------------------------------------

fr_git_lock() {
  local lock="$FR_CLAIMS/.git-lock" waited=0 holder
  mkdir -p "$FR_CLAIMS"
  while ! mkdir "$lock" 2>/dev/null; do
    holder=$(cat "$lock/pid" 2>/dev/null || true)
    if [[ -n $holder ]] && ! kill -0 "$holder" 2>/dev/null; then
      if mv "$lock" "$lock.stale.$$" 2>/dev/null; then
        rm -rf "$lock.stale.$$"
        fr_warn "stole the git lock from dead process $holder"
      fi
      continue
    fi
    sleep 1
    waited=$((waited + 1))
    [[ $waited -ge 120 ]] && fr_die "timed out waiting for the git lock ($lock)"
  done
  printf '%s' $$ >"$lock/pid"
}

fr_git_unlock() { rm -rf "$FR_CLAIMS/.git-lock"; }

fr_worktree_add() { # slot
  local slot=$1 slug branch wt base
  slug=$(fr_claim_get "$slot" slug)
  branch=$(fr_claim_get "$slot" branch)
  wt="$FR_WT_ROOT/$slug"
  fr_git_lock
  git -C "$FR_MAIN_PATH" fetch origin "$FR_BASE_BRANCH" --quiet \
    || { fr_git_unlock; fr_die "fetch of origin/$FR_BASE_BRANCH failed"; }
  base=$(git -C "$FR_MAIN_PATH" rev-parse "origin/$FR_BASE_BRANCH")
  # Record the path and base BEFORE creating anything at it.
  fr_claim_set "$slot" worktree "$wt"
  fr_claim_set "$slot" baseSha "$base"
  if git -C "$FR_MAIN_PATH" show-ref --verify --quiet "refs/heads/$branch"; then
    fr_log "branch $branch already exists — reusing it"
    git -C "$FR_MAIN_PATH" worktree add "$wt" "$branch" >/dev/null \
      || { fr_git_unlock; fr_die "worktree add failed"; }
  else
    git -C "$FR_MAIN_PATH" worktree add "$wt" -b "$branch" "origin/$FR_BASE_BRANCH" >/dev/null \
      || { fr_git_unlock; fr_die "worktree add failed"; }
  fi
  fr_git_unlock
  if [[ $FR_COPY_ENV == "true" ]]; then
    local f
    for f in "$FR_MAIN_PATH"/.env*; do
      [[ -f $f ]] && cp "$f" "$wt/$(basename "$f")" && chmod 600 "$wt/$(basename "$f")"
    done
  fi
}

# Removal, hardened per the 13.2 follow-up: a dying process can still be
# flushing files while the tree is deleted, which can surface a transient
# error even when the removal fully succeeded. Verify the directory is
# actually still there before reporting failure; retry once; escalate to a
# direct delete only as a last resort.
fr_worktree_remove() { # path
  local wt=$1
  fr_git_lock
  if [[ ! -d $wt ]]; then
    fr_log "worktree already gone"
    git -C "$FR_MAIN_PATH" worktree prune
    fr_git_unlock
    return 0
  fi
  if ! git -C "$FR_MAIN_PATH" worktree remove --force "$wt" 2>/dev/null; then
    if [[ ! -d $wt ]]; then
      fr_log "removal reported an error but the directory is gone — treating as success"
    else
      fr_warn "removal failed — retrying once"
      sleep 2
      if ! git -C "$FR_MAIN_PATH" worktree remove --force "$wt" 2>/dev/null && [[ -d $wt ]]; then
        fr_warn "removal still failing — deleting the directory directly"
        rm -rf "$wt"
      fi
    fi
  fi
  git -C "$FR_MAIN_PATH" worktree prune
  fr_git_unlock
  [[ -d $wt ]] && fr_die "could not remove $wt"
  return 0
}
