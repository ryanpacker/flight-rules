# Proposal: Parallel Dev Sessions with Git Worktrees

**Status:** Draft
**Author:** Claude
**Date:** 2025-01-17

---

## Executive Summary

Extend Flight Rules dev sessions to optionally run in isolated git worktrees, enabling multiple Claude agents to work on the same project simultaneously without file conflicts.

---

## Problem Statement

When working with AI coding agents, users often want to:
1. Run multiple agents in parallel on different tasks
2. Have one agent work on a long-running feature while another handles a quick fix
3. Experiment with different approaches simultaneously

Currently, running multiple Claude Code sessions on the same repository causes file conflicts—both agents edit the same files, leading to corruption and confusion.

---

## Proposed Solution

### Core Concept

When starting a dev session, the user can choose to create an **isolated worktree**. The session runs entirely within that worktree, and when the session ends, changes are merged back (via PR or direct merge) and the worktree is cleaned up.

```
/my-project                    ← main working directory
/my-project-sessions/          ← parallel session worktrees
  ├── auth-refactor/           ← Session A's worktree
  ├── api-endpoints/           ← Session B's worktree
  └── .manifest.json           ← tracks active sessions
```

---

## Detailed Design

### 1. Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /dev-session.start ──► User chooses "parallel" ──► Worktree    │
│         │                                            created     │
│         │                                               │        │
│         ▼                                               ▼        │
│  [Normal session in                            [Session runs     │
│   main directory]                               in worktree]     │
│         │                                               │        │
│         ▼                                               ▼        │
│  /dev-session.end                              /dev-session.end  │
│         │                                               │        │
│         ▼                                               ▼        │
│  [Commit offered]                              [Merge workflow]  │
│                                                         │        │
│                                                         ▼        │
│                                                [Worktree cleanup]│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Starting a Parallel Session

#### Modified `/dev-session.start` Flow

After reviewing project context and establishing goals, ask:

> "Would you like to run this session in an isolated worktree? This allows other agents to work on the project simultaneously."
>
> - **Standard session** (work in main directory)
> - **Parallel session** (create isolated worktree)

If parallel is chosen:

1. **Validate prerequisites**
   - Main directory must have no uncommitted changes (or offer to stash)
   - No existing worktree with the same name

2. **Create the worktree**
   ```bash
   # Create sessions directory if needed
   mkdir -p ../my-project-sessions

   # Create worktree with descriptive branch name
   git worktree add ../my-project-sessions/auth-refactor -b session/auth-refactor
   ```

3. **Initialize the worktree environment**
   - Run project-specific setup (npm install, etc.)
   - Copy any local config files (.env.local, etc.) if needed

4. **Register the session** in `.manifest.json` (see Section 5)

5. **Update session log location**
   - Session log still created in `docs/session_logs/` (shared across worktrees)
   - Log includes worktree path for reference

6. **Provide navigation instructions**
   > "Parallel session created. To work in this session, open a new terminal and run:
   > ```
   > cd ../my-project-sessions/auth-refactor
   > claude
   > ```
   > Use `/resume` to continue this session."

### 3. Working in a Parallel Session

#### What Changes
- All file edits happen in the worktree directory
- Git operations affect the session branch
- No interference with other sessions or main directory

#### What Stays the Same
- Session logs still go to `docs/session_logs/` (these are on the session branch)
- Progress tracking works normally
- All existing slash commands work

#### Cross-Session Awareness

The agent should be aware it's in a parallel session:
- Session log header includes: `**Worktree:** ../my-project-sessions/auth-refactor`
- Agent can check `.manifest.json` to see sibling sessions
- Agent should warn if editing files that other active sessions might touch

### 4. Ending a Parallel Session

#### Modified `/dev-session.end` Flow

After the standard review and summary steps:

1. **Commit all changes** (required for parallel sessions)
   - Cannot leave uncommitted changes in a worktree we'll delete

2. **Choose merge strategy**
   > "How would you like to integrate these changes?"
   > - **Create a PR** (recommended for review)
   > - **Merge directly to main** (for small/safe changes)
   > - **Keep branch for later** (don't merge yet, but clean up worktree)
   > - **Abandon** (discard all changes)

3. **Execute the merge strategy**

   **If creating a PR:**
   ```bash
   git push -u origin session/auth-refactor
   gh pr create --title "..." --body "..."
   ```

   **If merging directly:**
   ```bash
   # From main directory
   git checkout main
   git merge session/auth-refactor
   ```

   **If keeping for later:**
   - Push branch to remote
   - Document in session log that merge is pending

4. **Handle documentation artifacts**

   Before cleaning up, ensure these are preserved:
   - Session log (already on the branch, will be in PR)
   - Progress.md updates (on the branch)
   - Any spec updates (on the branch)

   For "keep for later" or "abandon":
   - Copy session log to main branch if valuable

5. **Clean up the worktree**
   ```bash
   git worktree remove ../my-project-sessions/auth-refactor
   # Optionally delete the branch if merged
   git branch -d session/auth-refactor
   ```

6. **Update manifest**
   - Remove session from `.manifest.json`
   - If no sessions remain, optionally remove the sessions directory

### 5. Session Manifest

Location: `../my-project-sessions/.manifest.json`

```json
{
  "version": 1,
  "project": "flight-rules",
  "sessions": [
    {
      "id": "auth-refactor",
      "branch": "session/auth-refactor",
      "worktree": "../my-project-sessions/auth-refactor",
      "startedAt": "2025-01-17T10:30:00Z",
      "sessionLog": "docs/session_logs/20250117_1030_session.md",
      "goals": ["Refactor authentication module"],
      "status": "active"
    },
    {
      "id": "api-endpoints",
      "branch": "session/api-endpoints",
      "worktree": "../my-project-sessions/api-endpoints",
      "startedAt": "2025-01-17T11:00:00Z",
      "sessionLog": "docs/session_logs/20250117_1100_session.md",
      "goals": ["Add new API endpoints"],
      "status": "active"
    }
  ]
}
```

### 6. New Slash Command: `/parallel.status`

Shows the state of all parallel sessions:

```
## Active Parallel Sessions

| Session | Branch | Started | Goals |
|---------|--------|---------|-------|
| auth-refactor | session/auth-refactor | 2h ago | Refactor authentication module |
| api-endpoints | session/api-endpoints | 1h ago | Add new API endpoints |

**Main directory:** /Users/you/my-project (clean)

To switch to a session:
  cd ../my-project-sessions/auth-refactor && claude
```

---

## Edge Cases and Dark Corners

### 7.1 Uncommitted Changes at Session Start

**Problem:** User has uncommitted changes in main when starting a parallel session.

**Solution:**
- Detect and warn: "You have uncommitted changes. Parallel sessions branch from HEAD."
- Offer options:
  - Commit them first
  - Stash them
  - Proceed anyway (changes won't be in the new worktree)

### 7.2 Orphaned Worktrees

**Problem:** User closes terminal without running `/dev-session.end`, leaving a worktree.

**Solution:**
- `/dev-session.start` checks manifest for orphaned sessions
- Offer to resume or clean up: "Found an incomplete session 'auth-refactor' from 2 days ago. Resume, clean up, or ignore?"
- Add a `/parallel.cleanup` command for manual recovery

### 7.3 Merge Conflicts

**Problem:** Two parallel sessions edited the same files.

**Solution:**
- When ending a session, check if the base branch has moved
- If conflicts are likely:
  > "The main branch has 5 new commits since this session started. Would you like to:
  > - Rebase onto main first (see conflicts before PR)
  > - Create PR anyway (resolve conflicts in PR)
  > - Keep branch for manual resolution"

### 7.4 Documentation Conflicts

**Problem:** Multiple sessions update `progress.md` or session logs.

**Solution:**
- Session logs: Use unique filenames (timestamp-based), no conflicts
- Progress.md: Each session appends; conflicts are append-only and easy to resolve
- Specs: More likely to conflict; warn if parallel sessions touch same spec file

### 7.5 Dependency Installation

**Problem:** Each worktree needs its own `node_modules`, increasing disk usage and setup time.

**Solution:**
- For Node.js: Consider pnpm with shared store, or document the tradeoff
- For Python: Each worktree gets its own venv
- General: Add `postCreateHook` to manifest for project-specific setup
- Alternative: Symlink node_modules for read-heavy projects (risky if deps change)

### 7.6 Environment Files

**Problem:** `.env.local` and similar files aren't in git but are needed.

**Solution:**
- During worktree creation, detect common env files in main
- Offer to copy them to the new worktree
- Document in manifest which files were copied

### 7.7 Shared Resources (Ports, Databases)

**Problem:** Two sessions try to run dev servers on the same port.

**Solution:**
- This is outside Flight Rules' scope, but document the pattern
- Suggest: Each session uses different ports (PORT=3001 for session A, PORT=3002 for session B)
- Suggest: Use session name in database names (myapp_auth_refactor_dev)

### 7.8 Long-Running Sessions

**Problem:** A session runs for days/weeks; main branch diverges significantly.

**Solution:**
- `/dev-session.start` could warn if the session is old
- Encourage periodic rebasing: "This session is 3 days old and 15 commits behind main. Consider rebasing."
- Add this to session log template: "Last synced with main: [date]"

### 7.9 Nested Worktree Confusion

**Problem:** User accidentally runs `/dev-session.start --parallel` from within a worktree.

**Solution:**
- Detect if current directory is already a worktree
- Warn: "You're already in a parallel session worktree. Start a new one from the main directory instead."

### 7.10 Session Log Visibility

**Problem:** Session log is on the branch; not visible from main until merged.

**Solution Options:**
1. **Keep logs on branch:** Clean, but invisible until merge
2. **Write logs to main:** Requires switching or pushing, adds noise
3. **Hybrid:** Write a stub to main ("Session in progress: auth-refactor"), full log on branch

**Recommendation:** Option 1 (logs on branch) with manifest providing visibility into active sessions.

---

## Alternative Approaches Considered

### A. Worktree Per Task (CCPM-style)

CCPM creates worktrees for each GitHub Issue, with aggressive parallelization.

**Rejected because:** Too heavyweight for Flight Rules' session-based model. Flight Rules sessions are human-guided; CCPM is more autonomous.

### B. Branch-Only (No Worktrees)

Just create branches and have agents switch between them.

**Rejected because:** File conflicts occur immediately when two agents work simultaneously. Branches alone don't provide isolation.

### C. Separate Clones

Clone the repository for each parallel session.

**Rejected because:** Wastes disk space, loses git history connection, harder to merge back.

### D. Containerized Sessions

Run each session in a Docker container with isolated filesystem.

**Rejected because:** Overkill for most use cases, adds significant complexity, slower to start.

---

## Implementation Phases

### Phase 1: Core Worktree Support
- [ ] Modify `/dev-session.start` to offer parallel option
- [ ] Implement worktree creation with manifest
- [ ] Modify `/dev-session.end` for merge workflow
- [ ] Add `/parallel.status` command

### Phase 2: Polish and Safety
- [ ] Orphan detection and cleanup
- [ ] Conflict detection before merge
- [ ] Environment file handling
- [ ] Better guidance for port/resource conflicts

### Phase 3: Advanced Features (Optional)
- [ ] `/parallel.sync` - rebase current session onto main
- [ ] Cross-session awareness (warn about overlapping files)
- [ ] Coordinator mode for overseeing multiple sessions

---

## Open Questions

1. **Where should the sessions directory live?**
   - Sibling directory (`../project-sessions/`) - cleaner, but requires knowing the parent
   - Subdirectory (`.sessions/`) - contained, but pollutes the project
   - Configurable - flexibility, but more complexity

2. **Should parallel sessions be opt-in or opt-out?**
   - Currently proposing opt-in (ask each time)
   - Could be: always parallel, or configurable default

3. **How do we handle the "coordinator" use case?**
   - User wants to oversee multiple agents from one terminal
   - Could add `/parallel.overview` that shows live status
   - Or rely on the manifest and status command

4. **Should we integrate with GitHub Issues?**
   - CCPM-style: each session tied to an issue
   - Adds complexity but improves traceability
   - Could be Phase 3

---

## Appendix: Example Session Flow

```
USER: /dev-session.start

AGENT: [Reviews project context...]
       What would you like to accomplish in this session?

USER: Refactor the authentication module to use JWT instead of sessions.

AGENT: Would you like to run this session in an isolated worktree?
       This allows other agents to work on the project simultaneously.

       • Standard session (work in main directory)
       • Parallel session (create isolated worktree)

USER: Parallel session

AGENT: Creating parallel session "auth-jwt-refactor"...

       ✓ Worktree created at ../flight-rules-sessions/auth-jwt-refactor
       ✓ Branch session/auth-jwt-refactor created
       ✓ Dependencies installed
       ✓ Session registered in manifest

       To work in this session, open a new terminal:

         cd ../flight-rules-sessions/auth-jwt-refactor
         claude

       Then use /resume to continue this conversation.

       Session plan documented in docs/session_logs/20250117_1400_session.md

--- [Later, in the worktree] ---

USER: /dev-session.end

AGENT: [Reviews work done, creates summary...]

       All changes have been committed. How would you like to integrate?

       • Create a PR (recommended for review)
       • Merge directly to main
       • Keep branch for later
       • Abandon changes

USER: Create a PR

AGENT: ✓ Pushed to origin/session/auth-jwt-refactor
       ✓ PR #42 created: "Refactor auth to use JWT"
       ✓ Worktree removed
       ✓ Session marked complete in manifest

       PR: https://github.com/you/project/pull/42
```

---

## Conclusion

This proposal adds parallel session support to Flight Rules by leveraging git worktrees. The design:

- **Integrates naturally** with existing `/dev-session.start` and `/dev-session.end` commands
- **Handles the hard parts** (merge, cleanup, orphan recovery)
- **Stays simple** for users who don't need parallelism
- **Scales** from 2 concurrent sessions to many

The main complexity is in the merge workflow and edge case handling, but these are well-understood git problems with established solutions.
