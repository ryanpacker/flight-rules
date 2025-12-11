# Flight Rules – Agent Guidelines

flight_rules_version: 0.1

This file defines how agents (Claude, Cursor, Windsurf, etc.) should work on software projects using the Flight Rules system.

It explains:
- How project docs are structured
- How implementation specs work
- How to use start / end coding sessions
- Where progress and learnings are tracked

The goal: any agent (or human) should be able to understand the project’s lifecycle and contribute without guesswork.

---

## 1. High-level lifecycle

For any “serious” project, assume this lifecycle:

1. **Idea & PRD** – captured in `docs/prd.md`
2. **Implementation spec** – 3-level spec system under `docs/implementation/`
3. **Coding sessions** – each session has:
   - A plan in `docs/session_plans/`
   - A detailed log in `docs/session_details/`
   - A brief summary in `docs/progress.md`
4. **Critical learnings** – promoted into `docs/critical-learnings.md`
5. **Commits & releases** – Git history + tags/releases reflect implementation of the specs

Agents should prefer working *with* this system rather than inventing their own structure.

---

## 2. Project docs structure

Each project that “installs” this system must have a `docs/` directory with (at minimum) the following:

- `docs/prd.md`  
  - Product requirements and high-level goals.
  - Agents should read this when clarifying “what are we building and why?”

- `docs/implementation/`  
  - Home of the implementation spec hierarchy (see next section).
  - The **spec is the single source of truth** for what should exist in the codebase and why.

- `docs/progress.md`  
  - A running high-level log of sessions and milestones.
  - Each session gets a short entry + link to its detailed log file.

- `docs/critical-learnings.md`  
  - A curated list of reusable insights, patterns, and “never again” notes.
  - Agents should propose additions when a session reveals something important or reusable.

- `docs/session_plans/`  
  - One file per coding session, named:
    - `YYYYMMDD_HHMM_session_plan.md`
  - Created by the **start coding session** process.

- `docs/session_details/`  
  - One file per coding session, named:
    - `YYYYMMDD_HHMM_session_details.md`
  - Created by the **end coding session** process.

Projects may add additional docs under `docs/` (e.g., architecture overviews, API references), but these are the canonical baseline.

Each project also has a `.agents/` directory containing:

- `.agents/commands/`  
  - Command files that agents execute when the user invokes specific workflows.
  - Examples: `start-coding-session.md`, `end-coding-session.md`

- `.agents/prompts/`  
  - Reusable prompt templates for common tasks.
  - Store frequently-used prompts here so they can be versioned and shared.

---

## 3. Implementation spec system (3 levels)

Implementation specs live in `docs/implementation/` and follow a 3-level structure:

1. **Level 1 – Implementation items overview**  
   - `docs/implementation/overview.md` lists the top-level implementation items (1, 2, 3, …).
   - Each item represents a major area of work (e.g., “Foundation & Shell Application”, “Core Domain Models”, etc.).
2. **Level 2 – Per-item directory**  
   - For each top-level item `N` there is a directory:  
     - `docs/implementation/{N}-{kebab-topic}/`
   - Inside that directory:
     - `index.md` – overview, goals, architecture context for that item
     - `{N}.{M}-topic.md` – detailed specs for each sub-area

3. **Level 3 – Detailed spec files**  
   - Each `{N}.{M}-topic.md` file contains:
     - Clear goals and scope
     - Constraints and decisions
     - A breakdown of tasks/steps
     - A `Status:` line

**Status tracking**

- Status is tracked **only in the detailed spec files** (`{N}.{M}-*.md`), not in code comments or random notes.- Typical status values:
  - `Status: 🔵 Planned`
  - `Status: 🟡 In Progress`
  - `Status: ✅ Complete`

**Core rule: the spec is the single source of truth**

- If the code deviates from the spec (because the user or agent made a change), that's acceptable **only if the spec is updated** to reflect reality.
- In an ideal world, someone could recreate the project from scratch by implementing each spec file one by one.

**Agent behavior with specs**

When working on code:

1. Identify the relevant implementation spec(s) for the task.
2. Explicitly reference the spec ID(s) (e.g., `1.2-authentication`) in your working notes / session plan.
3. After implementation:
   - Update the corresponding spec(s) with:
     - What was actually done
     - Any deviations from original plan
     - Updated `Status:` values

---

## 4. Coding sessions

The user will explicitly start and end sessions using commands or workflows like:

- **"start coding session"** → use `.agents/commands/start-coding-session.md`
- **"end coding session"**   → use `.agents/commands/end-coding-session.md`

Agents **must not** initiate these workflows on their own; they are only run when the user asks.

### 4.1 Start coding session

When the user triggers a start session command, follow the process defined in `.agents/commands/start-coding-session.md`. The generic behavior:

1. **Review project context**   - Read `docs/prd.md`, `docs/implementation/overview.md`, relevant spec files, and `docs/progress.md`.
   - Read the most recent `docs/session_details/*_session_details.md` if present.
   - Scan code as needed to understand current state.

2. **Establish session goals**   - Ask the user for goals for this session.
   - Suggest goals based on “Next Steps” from the last session and spec statuses.
   - Agree on a small set of specific, achievable goals.

3. **Create a detailed implementation plan**   - Collaborate with the user on approach:
     - Technical options (with pros/cons)
     - Constraints
     - Potential challenges and mitigations

4. **Document the session plan**   - Create `docs/session_plans/YYYYMMDD_HHMM_session_plan.md`.
   - Follow the “Session Plan Format” defined in that file.
   - Reference relevant implementation specs by ID.

5. **Confirm before coding**   - Show the user the plan (or a summary).
   - Ask explicitly:  
     > “The session plan has been documented in `docs/session_plans/YYYYMMDD_HHMM_session_plan.md`. Are you ready for me to begin implementing this plan?”  
   - **Do not** begin implementation until he confirms.

### 4.2 End coding session

When the user triggers an end session command, follow the process in `.agents/commands/end-coding-session.md`. Generic behavior:
1. **Review sandbox / scratch files**  
   - Identify temporary / sandbox code and determine, with the user, what to keep vs delete.

2. **Summarize the session**   - Draft a summary covering:
     - What was accomplished
     - Key decisions (especially deviations from spec)
     - Implementation details of note
     - Challenges and how they were resolved
     - Proposed next steps
   - Present the summary to the user for edits/approval.

3. **Write the detailed session log**   - Create `docs/session_details/YYYYMMDD_HHMM_session_details.md`.
   - Follow the detailed log format specified in this project’s `AGENTS.md` or the template.
   - Link to relevant implementation specs and code areas.

4. **Update `docs/progress.md`**   - Append a short entry under `# Session Logs`:
     - Date/time
     - 2–4 bullet summary
     - Link to the detailed session log file.

5. **Promote critical learnings**  
   - Scan the session details for reusable insights or “this will matter again” items.
   - Propose additions to `docs/critical-learnings.md` and update that file when the user approves.

6. **Offer to commit**   - Ask if the user wants to commit now.
   - If yes, help prepare a concise, meaningful commit message summarizing the session.

---

## 5. Agent behavior & tone

- **Opinionated but not rigid**  
  - Prefer following this workflow, but do not block the user if they want to "just do X in file Y right now."
  - It’s appropriate to say things like:
    - “We *could* create a quick session plan first; want to do that?”
    - “This change touches multiple specs; should we update them before we stop?”

- **Ask questions when uncertain**  
  - If an instruction is ambiguous, ask for clarification rather than guessing.

- **Defer to project-specific overrides**  
  - If the project has its own `AGENTS.local.md` or tool-specific config that extends these rules, follow those where they differ.

---

## 6. Where to look for project-specific instructions

When working in a project that uses this system:

1. Read this global `AGENTS.md` (or its copied variant).
2. Look for project-specific overrides or additions in:
   - `AGENTS.local.md` (if present)
   - Additional docs under `docs/` (e.g., `docs/architecture.md`, project-specific “how to run” guides)
3. Treat project-specific content as authoritative where it narrows or extends these global rules.

---

If you are an agent in this repository, your default behavior should be:

1. Respect the structure and workflows described here.
2. Use the implementation spec as the single source of truth.
3. Use start/end coding session workflows when the user explicitly invokes them.
4. Help keep PRD, specs, progress, and learnings clean, accurate, and up-to-date.
