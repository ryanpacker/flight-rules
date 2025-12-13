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

This repo is an npm package containing:

| Path | Purpose |
|------|---------|
| `payload/` | The Flight Rules content that gets delivered to your project as `.flight-rules/` |
| `src/` | CLI source code (TypeScript) |
| `dist/` | Compiled CLI (generated, committed for GitHub installs) |

Use the CLI to install, upgrade, and configure Flight Rules in your projects.

---

## Installation

### Quick Start (Recommended)

Install globally from GitHub:

```bash
npm install -g https://github.com/ryanpacker/flight-rules/tarball/main
```

Then initialize Flight Rules in any project:

```bash
cd your-project
flight-rules init
```

### Alternative: One-time Use with npx

Run directly without installing:

```bash
cd your-project
npx https://github.com/ryanpacker/flight-rules/tarball/main init
```

### What `init` Does

The `init` command will:
- Create `.flight-rules/` directory with all Flight Rules content
- Optionally generate agent adapters (AGENTS.md for Cursor, CLAUDE.md for Claude Code, etc.)
- Help you set up initial project docs

### Manual Installation

If you prefer not to use the CLI:

1. Clone this repo somewhere convenient:

   ```bash
   git clone https://github.com/ryanpacker/flight-rules.git ~/flight-rules
   cd ~/flight-rules && npm install && npm run build
   ```

2. Copy the payload into your project:

   ```bash
   cd /path/to/your/project
   cp -R ~/flight-rules/payload .flight-rules
   ```

3. Initialize your project docs by copying templates from `doc-templates/` to `docs/`.

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

## CLI Commands

| Command | Description |
|---------|-------------|
| `flight-rules init` | Install Flight Rules into a project (interactive setup wizard) |
| `flight-rules upgrade` | Upgrade Flight Rules in an existing project (preserves your docs) |
| `flight-rules adapter` | Generate agent-specific adapters (`--cursor`, `--claude`) |

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
├── package.json              # npm package configuration
├── tsconfig.json             # TypeScript configuration
├── README.md                 # This file
├── src/                      # CLI source code (TypeScript)
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── init.ts
│   │   ├── upgrade.ts
│   │   └── adapter.ts
│   └── utils/
│       └── files.ts          # File utilities
├── dist/                     # Compiled CLI (gitignored)
└── payload/                  # THE PAYLOAD - content delivered to projects as .flight-rules/
    ├── AGENTS.md             # Agent guidelines
    ├── doc-templates/        # Templates for project docs
    │   ├── prd.md
    │   ├── progress.md
    │   ├── critical-learnings.md
    │   ├── session-log.md
    │   └── implementation/
    │       └── overview.md
    ├── docs/                 # Empty structure for user content
    │   ├── implementation/
    │   └── session_logs/
    ├── commands/
    │   ├── start-coding-session.md
    │   └── end-coding-session.md
    └── prompts/
        └── prd/
```

**Key insight:** `doc-templates/` contains framework content that upgrades can replace. `docs/` is an empty structure for user content that upgrades never touch.

---

## Upgrading

Use the CLI to upgrade Flight Rules while preserving your content:

```bash
flight-rules upgrade
```

This replaces framework files while preserving your `docs/` directory.

**Safe to replace on upgrade:**
- `AGENTS.md` – Agent guidelines
- `doc-templates/` – Templates (your content is in `docs/`, not here)
- `commands/` – Workflow command definitions
- `prompts/` – Prompt templates

**Never replaced:**
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

- **Skills/MCP integration** – Conventions for documenting tools and workflows
- **Hosted planning systems** – Potential integration with Linear, etc.

For now, the focus is:

- A solid, Markdown-based structure
- Clear expectations for agents
- CLI tooling for easy installation and upgrades
