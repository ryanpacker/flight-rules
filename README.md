# Flight Rules

An opinionated framework for AI-assisted software development. Provides conventions for docs, implementation specs, and coding session workflows that both humans and agents can navigate.

The goal:  
Any agent (or person) should be able to open a project that “installs” this system and understand:

- What the project is trying to do
- How the implementation is structured
- What has already been done
- What should happen next
- What we’ve learned along the way

This repo is **global** and project-agnostic. Individual projects copy pieces of it into their own repo and then add **project-specific docs and specs** on top.

---

## Core ideas

### 1. Global vs project-specific

This repo defines:

- **Global conventions** for:
  - Directory layout
  - Implementation specs
  - Coding sessions
  - Progress and learnings
  - Agent behavior

Individual projects:

- **Install** those conventions (by copying templates from this repo)
- Add **project-specific** content:
  - `docs/prd.md` – the project’s own product requirements
  - `docs/implementation/` – the project’s own implementation specs
  - Project-specific architecture docs, runbooks, etc.

Over time, you should be able to:

- Run one or two commands at the start of a new project
- Have all the right scaffolding (docs, specs, session flows, agent configs) drop into place

### 2. The `docs/` directory

Every project that uses this system has a `docs/` directory as the **primary place for project knowledge**.

At minimum, each project should have:

- `docs/prd.md`  
  High-level product requirements and goals for this specific project.

- `docs/implementation/`  
  A structured set of implementation specs (see “Implementation spec model” below).

- `docs/progress.md`  
  A high-level log of progress and session summaries.

- `docs/critical-learnings.md`  
  A curated list of important, reusable insights and decisions.

- `docs/session_plans/`  
  One file per coding session, created via the **start-coding-session** flow.

- `docs/session_details/`  
  One file per coding session, created via the **end-coding-session** flow.

Projects can add more files under `docs/` (architecture diagrams, API docs, etc.), but these are the core ones the system assumes.

Additionally, each project has a `.agents/` directory for agent-specific resources:

- `.agents/commands/`  
  Command files that define workflows agents can execute (e.g., `start-coding-session.md`, `end-coding-session.md`).

- `.agents/prompts/`  
  Reusable prompt templates for common tasks. Version and share frequently-used prompts here.

### 3. Implementation spec model (single source of truth)

Implementation work is organized into a three-level spec system under `docs/implementation/`:

1. **Level 1: Overview**
   - `docs/implementation/overview.md`
   - Lists the major implementation areas (1, 2, 3, …) and what each is about.

2. **Level 2: Per-area directory**
   - For each top-level area `N`, a directory:
     - `docs/implementation/{N}-{kebab-topic}/`
   - Each directory contains:
     - `index.md` – overview for that implementation area
     - `{N}.{M}-topic.md` – detailed specs for sub-areas

3. **Level 3: Detailed spec files**
   - `{N}.{M}-topic.md` files contain:
     - Scope and goals
     - Constraints and decisions
     - A breakdown of tasks / steps
     - A `Status:` line (Planned / In Progress / Complete)

**Key principle: the spec is the single source of truth.**

- Agents and humans should **update the spec** whenever reality diverges from the plan.
- It should be possible, in theory, to recreate the project by implementing the spec files one by one.
- Status is tracked **in the spec files**, not scattered across comments and ad-hoc notes.

### 4. Coding sessions

This system distinguishes between:

- **Normal, ad-hoc requests** (e.g., “Change function X in file Y”)
- **Structured coding sessions**, which follow a start/end ritual and produce durable documentation

There are two core flows:

- `start-coding-session`
- `end-coding-session`

These are implemented as templates under `.agents/commands/` in this repo and copied into each project.

Agents **do not** start or end sessions on their own.  
The user explicitly invokes these flows using commands or prompts defined in the tool-specific configs (for example, Windsurf commands).

#### 4.1 Start coding session

When `start-coding-session` is invoked in a project, the agent will:

1. Review project context:
   - `docs/prd.md`
   - `docs/implementation/overview.md` and relevant spec files
   - `docs/progress.md`
   - The most recent session details file (if present)
2. Agree on session goals with the user
3. Propose and refine an implementation approach
4. Create a **session plan** in:
   - `docs/session_plans/YYYYMMDD_HHMM_session_plan.md`
5. Confirm with the user before making any changes to code

This keeps “what we’re about to do” visible and tied back to specific specs.

#### 4.2 End coding session

When `end-coding-session` is invoked, the agent will:

1. Review sandbox or scratch work and help decide what to keep vs discard
2. Summarize:
   - What was done
   - Key implementation details
   - Decisions (especially if they diverge from the spec)
   - Challenges and how they were resolved
   - Proposed next steps
3. Write a **detailed session log** in:
   - `docs/session_details/YYYYMMDD_HHMM_session_details.md`
4. Append a short entry to `docs/progress.md` linking to the detailed log
5. Suggest additions to `docs/critical-learnings.md` when there are reusable insights
6. Optionally help prepare a commit message and summarize the work for version control

Session documentation is **opinionated but not mandatory**.  
For some small or trivial changes, you might skip the session commands and just work directly. For larger or ongoing efforts, the start/end flows provide structure.

### 5. Agents are opinionated, not authoritarian

Agents following this system should:

- Prefer the structured workflow:
  - Read the PRD and specs
  - Work against the implementation spec
  - Use session flows when appropriate
  - Keep docs aligned with reality
- Ask questions when something is ambiguous
- Make strong recommendations (e.g., “We should create a session plan for this”)  
  **but not block progress** if you intentionally want to work quickly or informally

This is a **personal system**, not a compliance framework.

### 6. Versioning

Each project tracks which version of this system it uses via a version marker in `AGENTS.md`:

```
flight_rules_version: 0.1
```

This helps with:

* Knowing when a project is out of date
* Understanding which conventions apply
* Coordinating upgrades across multiple projects

The version follows semantic versioning principles:

* **Major versions** (1.0, 2.0) indicate breaking changes to conventions or structure
* **Minor versions** (0.1, 0.2) indicate new features or non-breaking additions
* **Patch versions** (0.1.1) indicate documentation fixes or clarifications

---

## Repo structure (this repo, not a project)

A rough layout of this “OS” repo:

```text
.
├─ README.md                # This file
├─ AGENTS.md                # Global, agent-agnostic behavior and expectations
├─ docs/
│  ├─ overview.md           # Human overview of how docs/ works
│  ├─ structure.md          # Detailed description of directories/files
│  ├─ sessions.md           # Explains start/end coding session concepts
│  └─ implementation-spec.md# Explains the 3-level implementation spec model
├─ templates/
│  └─ project/
│     ├─ AGENTS.md
│     ├─ docs/
│     │  ├─ prd.md
│     │  ├─ implementation/
│     │  │  └─ overview.md
│     │  ├─ progress.md
│     │  ├─ critical-learnings.md
│     │  ├─ session_plans/
│     │  │  └─ session_plan.template.md
│     │  └─ session_details/
│     │     └─ session_detail.template.md
│     └─ .agents/
│        ├─ commands/
│        │  ├─ start-coding-session.md
│        │  └─ end-coding-session.md
│        └─ prompts/
│           └─ .gitkeep
└─ tools/
   ├─ claude.template.md
   ├─ cursor.cursorrules.template
   ├─ windsurf.template.md
   └─ generic-agent.md
```

* The **templates** directory is what gets copied into individual projects.
* The **tools** directory contains adapter templates for different coding agents (how they should load and interpret this system).

---

## Installing into a new project (manual, for now)

Until there’s a dedicated installer (like an NPM/Composer-style tool), setup will be manual:

1. **Clone this repo** somewhere convenient:

   ```bash
   git clone <this-repo-url> personal-dev-os
   ```

2. **Copy the project template** into your new or existing project:

   ```bash
   cd /path/to/your/project
   cp -R /path/to/personal-dev-os/templates/project/* .
   ```

3. **Review and customize:**

   * Edit `AGENTS.md` in the project:

     * Fill in project name and any project-specific notes
   * Edit `docs/prd.md`:

     * Define the project’s product requirements
   * Edit `docs/implementation/overview.md`:

     * Define your top-level implementation areas

4. **Wire up tools (optional initial step):**

   * For Claude Code, Cursor, Windsurf, etc., copy or generate the appropriate config from:

     * `tools/claude.template.md`
     * `tools/cursor.cursorrules.template`
     * `tools/windsurf.template.md`
   * Adjust paths if needed so those tools “see”:

     * `AGENTS.md`
     * `docs/`
     * `docs/implementation/`

5. **Start working:**

   * Use normal prompts for small tasks
   * Use `start-coding-session` and `end-coding-session` when you want the full structured flow

Later, this process should be replaced or augmented by a small script/CLI that:

* Clones this repo (if needed)
* Copies the right templates
* Generates tool-specific configs from a single, tool-agnostic source of truth

---

## Upgrading a project

When the global system evolves, you can upgrade a project by copying the latest templates over the existing files:

```bash
cd /path/to/your/project
cp -R /path/to/personal-dev-os/templates/project/* .
```

This works because:

* Template files (like `AGENTS.md`, session templates, etc.) contain **no project-specific content**
* Project-specific content lives in files like `docs/prd.md` and `docs/implementation/` specs, which are not overwritten by templates
* The version marker in your project's `AGENTS.md` will be updated to reflect the new version

After upgrading:

1. Review `AGENTS.md` for any new conventions or expectations
2. Check release notes (if any) for breaking changes
3. Regenerate tool-specific configs if needed

---

## Using this system in day-to-day work

### When you open a project

Agents (and you) should:

1. Read `AGENTS.md` in the project root
2. Skim:

   * `docs/prd.md`
   * `docs/implementation/overview.md`
3. Skim `docs/progress.md` and the most recent session details file to see what was done last

### When you want focus and traceability

Use the session commands:

* `start-coding-session` to:

  * Set clear goals
  * Connect work to specific specs
  * Capture a structured session plan

* `end-coding-session` to:

  * Summarize the work
  * Update progress
  * Capture critical learnings
  * Optionally prepare commits

### When you’re making significant changes

* Identify which implementation spec(s) the change belongs to
* Update those spec files as part of the work
* Make sure `Status:` reflects reality

---

## Agents and tools

This repo assumes that agents will be configured via tool-specific files (templates live under `tools/`).

Those files:

* Tell the agent where to find:

  * `AGENTS.md`
  * `docs/`
  * The implementation spec tree
* Explain how to:

  * React to session commands
  * Use the spec as the source of truth
  * Read and update progress and learnings

Over time, these tool-specific files should be generated automatically from a **single, tool-agnostic spec** rather than maintained by hand.

---

## Future directions

Some things that are intentionally not fully defined yet:

* **Automation / installer**

  * A small CLI or script to “install” this system into a project and regenerate tool-specific config files.

* **Skills / MCP / external tools**

  * A convention for documenting skills (MCP servers, tools, workflows) so agents can discover and use them consistently.

* **Hosted planning systems**

  * Eventually, implementation specs and plans might live in tools like Linear instead of staying entirely in Markdown. This system should adapt to that when it happens.

For now, the focus is on:

* A solid, Markdown-based structure
* Clear expectations for agents
* A path to automation later
