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

## Quick Start

Install the CLI globally:

```bash
npm install -g https://github.com/ryanpacker/flight-rules/tarball/main
```

Then initialize Flight Rules in any project:

```bash
cd your-project
flight-rules init
```

Or run directly without installing:

```bash
npx https://github.com/ryanpacker/flight-rules/tarball/main init
```

The `init` command will:
- Create a `.flight-rules/` directory with framework files
- Optionally create a `docs/` directory with project documentation from templates
- Optionally generate agent adapters (AGENTS.md for Cursor, CLAUDE.md for Claude Code, etc.)

---

## How It Works

Flight Rules gives your project a structured documentation system that AI agents (and humans) can navigate consistently.

### Project Structure

| Location | Purpose |
|----------|---------|
| `.flight-rules/` | Framework files (can be replaced on upgrade) |
| `docs/` | Your project documentation (never touched by upgrades) |

**Inside `.flight-rules/`:**

| Directory | Purpose |
|-----------|---------|
| `AGENTS.md` | Guidelines for AI agents working on your project |
| `doc-templates/` | Templates for creating project docs |
| `commands/` | Workflow commands (start/end coding session) |
| `prompts/` | Reusable prompt templates |

### Implementation Specs (Single Source of Truth)

Implementation specs live in `docs/implementation/` and follow a three-level hierarchy:

| Level | Name | Example | Description |
|-------|------|---------|-------------|
| 1 | **Area** | `1-foundation-shell/` | A major implementation area |
| 2 | **Task Group** | `1.4-application-shell.md` | A file containing related tasks |
| 3 | **Task** | `1.4.1. Routing Structure` | A specific unit of work with status |

**Key principle:** The spec is the single source of truth. If code diverges from spec, update the spec.

### Coding Sessions

Flight Rules distinguishes between:

- **Ad-hoc requests** — "Change function X in file Y"
- **Structured sessions** — Follow a start/end ritual with documentation

Two core flows:

- **`start-coding-session`** — Review context, set goals, create a plan
- **`end-coding-session`** — Summarize work, update progress, capture learnings

Agents don't start these flows on their own; you explicitly invoke them.

### Versioning

Each project tracks which Flight Rules version it uses:

```
flight_rules_version: 0.1.2
```

This appears in `.flight-rules/AGENTS.md` and helps coordinate upgrades.

---

## What Gets Installed

When you run `flight-rules init`, you get:

```text
your-project/
├── AGENTS.md                 # (Optional) Adapter for Cursor - points to .flight-rules/
├── docs/                     # YOUR content (never touched by upgrades)
│   ├── prd.md
│   ├── progress.md
│   ├── critical-learnings.md
│   ├── implementation/
│   │   └── overview.md
│   └── session_logs/
└── .flight-rules/            # Framework files (can be replaced on upgrade)
    ├── AGENTS.md             # Agent guidelines
    ├── doc-templates/        # Templates for creating your docs
    │   ├── prd.md
    │   ├── progress.md
    │   ├── critical-learnings.md
    │   ├── session-log.md
    │   └── implementation/
    │       └── overview.md
    ├── commands/
    │   ├── start-coding-session.md
    │   └── end-coding-session.md
    └── prompts/              # Reusable prompt templates
```

---

## Day-to-Day Usage

### When you open a project

1. Agents should read `.flight-rules/AGENTS.md`
2. Skim `docs/prd.md` and `docs/implementation/overview.md`
3. Check `docs/progress.md` for recent work

### For structured work

- **"start coding session"** — Sets goals, creates a plan
- **"end coding session"** — Summarizes work, updates docs

### When making changes

- Identify relevant Area, Task Group, and Task
- Update Tasks when reality diverges from plan
- Keep `Status:` fields current

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `flight-rules init` | Install Flight Rules into a project (interactive setup wizard) |
| `flight-rules upgrade` | Upgrade Flight Rules in an existing project (preserves your docs) |
| `flight-rules adapter` | Generate agent-specific adapters (`--cursor`, `--claude`) |

---

## Upgrading

Upgrade Flight Rules while preserving your content:

```bash
flight-rules upgrade
```

**What gets replaced:**
- The `.flight-rules/` directory (framework files)

**What is never touched:**
- `docs/` at your project root (your content)

After upgrading, check `.flight-rules/doc-templates/` for new templates or updated guidance you might want to incorporate.

---

## Manual Installation

If you prefer not to use the CLI:

1. Clone this repo:

   ```bash
   git clone https://github.com/ryanpacker/flight-rules.git ~/flight-rules
   ```

2. Copy the payload into your project:

   ```bash
   cp -R ~/flight-rules/payload /path/to/your/project/.flight-rules
   ```

3. Create a `docs/` directory and copy templates from `.flight-rules/doc-templates/` to customize them.

---

## Future Directions

- **Skills/MCP integration** — Conventions for documenting tools and workflows
- **Hosted planning systems** — Potential integration with Linear, etc.
- **npm registry publishing** — Simpler installation (targeting v0.2)

For now, the focus is:

- A solid, Markdown-based structure
- Clear expectations for agents
- CLI tooling for easy installation and upgrades

---

## Contributing

This repo is an npm package with the following structure:

| Path | Purpose |
|------|---------|
| `src/` | CLI source code (TypeScript) |
| `dist/` | Compiled CLI (committed for GitHub installs) |
| `payload/` | The content delivered to projects as `.flight-rules/` |
| `scripts/` | Build and release utilities |

### Development

```bash
git clone https://github.com/ryanpacker/flight-rules.git
cd flight-rules
npm install
npm run build
```

### Releasing

```bash
npm version patch   # or minor/major
git push && git push --tags
```

This automatically builds, syncs the version to `payload/AGENTS.md`, and creates a tagged commit.
