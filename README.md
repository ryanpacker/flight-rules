# Flight Rules

> **Early Development**: This project is in active development (v0.x). APIs and conventions may change between versions. Install with the `dev` tag.

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
npm install -g flight-rules@dev
```

Then initialize Flight Rules in any project:

```bash
cd your-project
flight-rules init
```

Or run directly without installing:

```bash
npx flight-rules@dev init
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
| `.flight-rules/` | Framework files (replaced on upgrade) |
| `docs/` | Your project documentation (new templates added on upgrade, existing files preserved) |

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

- **`dev-session.start`** — Review context, set goals, create a plan
- **`dev-session.end`** — Summarize work, update progress, capture learnings

Agents don't start these flows on their own; you explicitly invoke them.

### Available Commands

Flight Rules provides workflow commands that agents can execute:

| Command | Purpose |
|---------|---------|
| `/dev-session.start` | Begin a structured coding session with goals and plan |
| `/dev-session.end` | End session, summarize work, update progress |
| `/prd.create` | Create a Product Requirements Document |
| `/prd.clarify` | Refine specific sections of an existing PRD |
| `/impl.outline` | Create implementation area structure |
| `/impl.create` | Add detailed tasks to implementation specs |
| `/feature.add` | Add a new feature to PRD and implementation docs |
| `/test.add` | Add tests for specific functionality |
| `/test.assess-current` | Analyze existing test coverage |
| `/prompt.refine` | Iteratively improve a prompt |
| `/readme.create` | Generate README from PRD and project state |
| `/readme.reconcile` | Update README to reflect recent changes |
| `/prd.reconcile` | Update PRD based on what was actually built |
| `/impl.reconcile` | Update implementation docs with status changes |
| `/docs.reconcile` | Run all reconcile commands + consistency check |

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
├── docs/                     # YOUR content (new templates added on upgrade)
│   ├── prd.md
│   ├── progress.md
│   ├── critical-learnings.md
│   ├── tech-stack.md
│   ├── implementation/
│   │   └── overview.md
│   └── session_logs/
└── .flight-rules/            # Framework files (can be replaced on upgrade)
    ├── AGENTS.md             # Agent guidelines
    ├── doc-templates/        # Templates for creating your docs
    │   ├── prd.md
    │   ├── progress.md
    │   ├── critical-learnings.md
    │   ├── tech-stack.md
    │   ├── session-log.md
    │   └── implementation/
    │       └── overview.md
    ├── commands/             # Workflow commands
    │   ├── dev-session.start.md
    │   ├── dev-session.end.md
    │   ├── prd.create.md
    │   ├── prd.clarify.md
    │   ├── impl.outline.md
    │   ├── impl.create.md
    │   ├── feature.add.md
    │   ├── test.add.md
    │   ├── test.assess-current.md
    │   ├── prompt.refine.md
    │   ├── readme.create.md
    │   ├── readme.reconcile.md
    │   ├── prd.reconcile.md
    │   ├── impl.reconcile.md
    │   └── docs.reconcile.md
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
| `flight-rules update` | Update the Flight Rules CLI itself (`--channel` to switch dev/latest) |
| `flight-rules ralph` | Run autonomous agent loop through task groups |

---

## Autonomous Development with Ralph

Flight Rules includes support for "Ralph Loops" — autonomous AI agent loops that work through your implementation specs unattended.

### How It Works

Ralph spawns fresh Claude Code instances in a loop. Each iteration:

1. Reads your implementation specs
2. Finds the next incomplete task group
3. Implements all tasks in that group
4. Runs quality checks (reads `package.json` to discover available scripts)
5. Commits the work
6. Exits (triggering the next fresh iteration with a clean context)

The loop terminates when all task groups are complete or max iterations is reached.

Memory persists between iterations via:
- Git history (commits from previous iterations)
- `docs/progress.md` (work log)
- `docs/ralph_logs/` (verbose session logs)
- `docs/critical-learnings.md` (patterns and gotchas)
- The implementation spec files themselves (status updates)

### Running Ralph

```bash
# Start the loop (default 10 iterations)
flight-rules ralph

# Run with more iterations
flight-rules ralph --max-iterations 20
flight-rules ralph -n 20

# Focus on a specific implementation area
flight-rules ralph --area 2
flight-rules ralph --area 2-cli-core

# Create a new branch before starting (recommended)
flight-rules ralph --branch                    # Auto-generates: ralph/YYYYMMDD-HHMM
flight-rules ralph --branch feature/my-work    # Custom branch name

# Combine options for a typical workflow
flight-rules ralph --area 2 --branch -n 20

# See what would run without executing
flight-rules ralph --dry-run

# See full Claude output during execution
flight-rules ralph --verbose
```

### Prerequisites

- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`
- Authenticated with Claude Code: run `claude` and follow prompts
- Implementation specs with task groups to work through

### Best Practices

1. **Use `--branch`**: Always create a new branch before starting a Ralph loop for easy rollback and PR workflow
2. **Target specific areas**: Use `--area` to focus Ralph on one implementation area at a time
3. **Small task groups**: Each task group should be completable within one context window
4. **Clear acceptance criteria**: Ralph works best with specific, verifiable criteria
5. **Quality checks configured**: Ensure `npm test`, `npm run lint`, etc. are set up in `package.json`
6. **Review the work**: Ralph commits frequently — review with `git log` and create a PR for code review
7. **Container usage**: For maximum safety, run in a Docker container without network access

### Security Note

Ralph uses `--dangerously-skip-permissions` to run Claude autonomously. This flag bypasses all permission prompts. Use with caution and preferably in isolated environments.

---

## Upgrading

Upgrade Flight Rules while preserving your content:

```bash
flight-rules upgrade
```

**What gets replaced:**
- The `.flight-rules/` directory (framework files)

**What gets added (without overwriting):**
- New templates are added to `docs/` if they don't already exist
- Your existing doc files are never modified

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
- **v1.0 stability** — Stabilizing APIs and conventions for a production-ready release

Current focus:

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

### Testing

The project uses [Vitest](https://vitest.dev/) for testing with ~93% code coverage.

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

Tests are located in `tests/` and mirror the `src/` structure:

| Test File | Coverage |
|-----------|----------|
| `tests/utils/files.test.ts` | 100% |
| `tests/commands/init.test.ts` | 98.5% |
| `tests/commands/upgrade.test.ts` | 100% |
| `tests/commands/adapter.test.ts` | 79% |

### Releasing

```bash
npm version patch   # or minor/major
git push && git push --tags
npm publish --tag dev
```

This automatically builds, syncs the version to `payload/AGENTS.md`, creates a tagged commit, and publishes to npm.

> **Note:** Until v1.0, all releases use the `dev` tag. Users install with `npm install -g flight-rules@dev`.
