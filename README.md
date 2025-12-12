# Flight Rules

An opinionated framework for AI-assisted software development. Provides conventions for docs, implementation specs, and coding session workflows that both humans and agents can navigate.

The goal:  
Any agent (or person) should be able to open a project that uses Flight Rules and understand:

- What the project is trying to do
- How the implementation is structured
- What has already been done
- What should happen next
- What we've learned along the way

---

## How It Works

This repo contains the **source template** that gets installed into your projects.

| This Repo | Your Project |
|-----------|--------------|
| `src/` | `.flight-rules/` |
| `tools/` | Scripts/prompts that generate coding agent-specific adapters |

Everything in `src/` gets copied to your project as `.flight-rules/`. The `tools/` directory contains scripts or prompts that can generate coding agent-specific adapter files (like `AGENTS.md` or `.cursor/rules` for Cursor or `CLAUDE.md` or `.claude/rules` for Claude Code) in your project root.

---

## What Gets Installed

When you install Flight Rules into a project, you get:

```text
your-project/
├── AGENTS.md                 # (Optional) Adapter for Cursor - points to .flight-rules/
└── .flight-rules/
    ├── AGENTS.md             # Agent guidelines (the real content)
    ├── doc-templates/        # Templates (safe to upgrade)
    │   ├── prd.md
    │   ├── progress.md
    │   ├── critical-learnings.md
    │   ├── session-log.md
    │   └── implementation/
    │       └── overview.md
    ├── docs/                 # YOUR content (never touched by upgrades)
    │   ├── implementation/   # Your specs go here
    │   └── session_logs/     # Session logs accumulate here
    ├── commands/
    │   ├── start-coding-session.md
    │   └── end-coding-session.md
    └── prompts/              # Reusable prompt templates
```

**Key distinction:**
- **`doc-templates/`** – Flight Rules framework files. These get replaced on upgrade.
- **`docs/`** – Your project content. Flight Rules never overwrites this directory.

When you first set up a project, copy templates from `doc-templates/` into `docs/` (or have an agent do it). After that, `docs/` is yours—Flight Rules upgrades won't touch it.

---

## Core Concepts

### 1. The `.flight-rules/` Directory

All Flight Rules content lives in a single hidden directory at your project root. This keeps things organized and clearly separates "Flight Rules stuff" from your actual code.

Inside `.flight-rules/`:

- **`AGENTS.md`** – The main agent guidelines
- **`doc-templates/`** – Templates for project docs (PRD, progress, specs, etc.)
- **`docs/`** – Your project documentation (copied from templates, then customized)
- **`commands/`** – Workflow commands (start/end coding session)
- **`prompts/`** – Reusable prompt templates

### 2. Implementation Specs (Single Source of Truth)

Implementation specs are organized into a three-level hierarchy under `.flight-rules/docs/implementation/`:

| Level | Name | Example | Description |
|-------|------|---------|-------------|
| 1 | **Area** | `1-foundation-shell/` | A major implementation area |
| 2 | **Task Group** | `1.4-application-shell.md` | A file containing related tasks |
| 3 | **Task** | `1.4.1. Routing Structure` | A specific unit of work with status |

- `overview.md` lists all Areas (copy from `doc-templates/implementation/overview.md` first)
- Each Area directory contains Task Group files (`{N}.{M}-topic.md`)
- Each Task Group file contains individual Tasks with their own status

**Key principle:** The spec is the single source of truth. If code diverges from spec, update the spec.

### 3. Coding Sessions

Flight Rules distinguishes between:

- **Ad-hoc requests** – "Change function X in file Y"
- **Structured sessions** – Follow a start/end ritual with documentation

Two core flows:

- **`start-coding-session`** – Review context, set goals, create a plan
- **`end-coding-session`** – Summarize work, update progress, capture learnings

Session documentation goes in `.flight-rules/docs/session_logs/`. Agents don't start these flows on their own; you explicitly invoke them.

### 4. Versioning

Each project tracks which Flight Rules version it uses:

```
flight_rules_version: 0.1
```

This appears in `.flight-rules/AGENTS.md` and helps coordinate upgrades.

---

## This Repo's Structure

```text
.
├── README.md                 # This file
├── src/                      # THE TEMPLATE - everything here ships to projects
│   ├── AGENTS.md             # Agent guidelines
│   ├── doc-templates/        # Templates for project docs
│   │   ├── prd.md
│   │   ├── progress.md
│   │   ├── critical-learnings.md
│   │   ├── session-log.md
│   │   └── implementation/
│   │       └── overview.md
│   ├── docs/                 # Empty structure for user content
│   │   ├── implementation/
│   │   └── session_logs/
│   ├── commands/
│   │   ├── start-coding-session.md
│   │   └── end-coding-session.md
│   └── prompts/
│       └── prd/
└── tools/                    # Scripts/prompts to generate coding agent-specific adapters
    ├── cursor-agents.md      # Generates AGENTS.md for Cursor
    └── claude-md.md          # Generates CLAUDE.md for Claude Code
```

**Key insight:** `doc-templates/` contains framework content that upgrades can replace. `docs/` is an empty structure for user content that upgrades never touch.

---

## Installing (Manual)

Until there's a dedicated installer CLI:

1. **Clone this repo** somewhere convenient:

   ```bash
   git clone https://github.com/ryanpacker/flight-rules.git ~/flight-rules
   ```

2. **Copy the source template** into your project:

   ```bash
   cd /path/to/your/project
   cp -R ~/flight-rules/src .flight-rules
   ```

3. **Generate coding agent specific adapters** (optional, based on what AI tools you use):

   Use the scripts or prompts in `tools/` to generate adapter files for your specific AI coding agents. These adapters create files like `AGENTS.md` (for Cursor), or `CLAUDE.md` (for Claude Code) at your project root that point to `.flight-rules/`.

4. **Initialize your project docs:**

   Copy the templates you need from `doc-templates/` to `docs/`:

   ```bash
   # Example: set up PRD and implementation overview
   cp .flight-rules/doc-templates/prd.md .flight-rules/docs/prd.md
   cp .flight-rules/doc-templates/progress.md .flight-rules/docs/progress.md
   cp .flight-rules/doc-templates/critical-learnings.md .flight-rules/docs/critical-learnings.md
   cp .flight-rules/doc-templates/implementation/overview.md .flight-rules/docs/implementation/overview.md
   ```

   Or ask your AI agent: "Help me set up the Flight Rules docs for this project"

5. **Customize your project:**

   - Edit `.flight-rules/docs/prd.md` – Define your product requirements
   - Edit `.flight-rules/docs/implementation/overview.md` – Define implementation areas

6. **Start working:**

   - Use normal prompts for small tasks
   - Say "start coding session" or "end coding session" for structured work

---

## Upgrading

When Flight Rules evolves, upgrade the framework files while preserving your content:

```bash
cd /path/to/your/project

# Replace framework files (safe - these don't contain your content)
cp ~/flight-rules/src/AGENTS.md .flight-rules/
cp -R ~/flight-rules/src/doc-templates .flight-rules/
cp -R ~/flight-rules/src/commands .flight-rules/
cp -R ~/flight-rules/src/prompts .flight-rules/

# NEVER run: cp -R ~/flight-rules/src/docs .flight-rules/
# Your docs/ directory contains your project content!
```

**Safe to replace on upgrade:**
- `AGENTS.md` – Agent guidelines
- `doc-templates/` – Templates (your content is in `docs/`, not here)
- `commands/` – Workflow command definitions
- `prompts/` – Prompt templates

**Never replace:**
- `docs/` – This is YOUR project content (PRD, specs, progress, session logs)

After upgrading, check `doc-templates/` for any new templates or updated guidance you might want to incorporate into your existing docs.

---

## Day-to-Day Usage

### When you open a project

1. Agents should read `.flight-rules/AGENTS.md`
2. Skim `.flight-rules/docs/prd.md` and `implementation/overview.md`
3. Check `.flight-rules/docs/progress.md` for recent work

### For structured work

- **"start coding session"** – Sets goals, creates a plan
- **"end coding session"** – Summarizes work, updates docs

### When making changes

- Identify relevant Area, Task Group, and Task
- Update Tasks when reality diverges from plan
- Keep `Status:` fields current

---

## Future Directions

Not yet defined:

- **Installer CLI** – Script to install/upgrade Flight Rules
- **Skills/MCP integration** – Conventions for documenting tools and workflows
- **Hosted planning systems** – Potential integration with Linear, etc.

For now, the focus is:

- A solid, Markdown-based structure
- Clear expectations for agents
- A path to automation later
