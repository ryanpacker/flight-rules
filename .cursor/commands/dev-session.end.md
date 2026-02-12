# End Coding Session

When the user invokes "end coding session", follow this process:

## 1. Review Work Done

Identify:
- What code was written or modified
- Any sandbox/scratch files that need to be kept or discarded
- Any temporary debugging code that should be removed

Ask the user about anything uncertain.

## 2. Summarize the Session

Draft a summary covering:
- **What was accomplished** – Key deliverables
- **Key decisions** – Especially any deviations from the original plan
- **Implementation details** – Notable technical choices
- **Challenges and solutions** – Problems encountered and how they were resolved
- **Proposed next steps** – What should happen in future sessions

Present the summary to the user for review and approval.

## 3. Update the Session Log

Update the session log file in `docs/session_logs/YYYYMMDD_HHMM_session.md`

Use the template at `.flight-rules/doc-templates/session-log.md` as a guide if creating a new log.

Include:
- Summary
- Goal completion status
- Detailed description of work
- Key decisions
- Challenges and solutions
- Code areas touched
- Spec updates needed
- Next steps

## 4. Update Progress

Append a short entry to `docs/progress.md`:

```markdown
### YYYY-MM-DD HH:MM

- Brief summary point 1
- Brief summary point 2
- See: [session_logs/YYYYMMDD_HHMM_session.md](session_logs/YYYYMMDD_HHMM_session.md)
```

## 5. Propose Spec Updates

If implementation deviated from specs or completed spec items:
- Identify which spec files need updates
- Propose the specific changes to the user for approval
- Update specs when approved

## 6. Promote Critical Learnings

Scan the session for reusable insights:
- Patterns that worked well
- Mistakes to avoid
- Important decisions that should inform future work

Propose additions to `docs/critical-learnings.md` and update when approved.

## 7. Offer to Commit

Ask the user:
> "Would you like to commit these changes now?"

If yes, help prepare a commit message that:
- Summarizes what was accomplished
- References the session log file
- Is concise but meaningful

## 8. Handle Parallel Session (If Applicable)

If this session is running in a parallel worktree (check if the current directory is inside a `*-sessions/` worktree path, or check `git rev-parse --git-dir` for linked worktrees):

1. **Ensure all changes are committed** — parallel sessions require committed changes before cleanup
2. **Offer merge strategy:**
   > "This is a parallel session. How would you like to integrate these changes?"
   > - **Create a PR** (recommended for review)
   > - **Merge directly to main** (for small/safe changes)
   > - **Keep branch for later** (don't merge yet, but clean up worktree)
   > - **Abandon** (discard all changes)

3. Run `flight-rules parallel remove <session-name>` which will execute the chosen strategy and clean up the worktree
4. If choosing to create a PR, include the session summary in the PR description


