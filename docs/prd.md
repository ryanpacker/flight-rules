# Product Requirements Document

## Overview

Flight Rules is an opinionated framework for AI-assisted software development. It provides a standardized structure for documentation, implementation specs, and coding session workflows that both humans and AI agents can navigate consistently.

The core problem: when an AI agent opens a project, it lacks context about what the project is, what's been done, and what comes next. Flight Rules creates a predictable structure so any agent (or human) can get oriented quickly.

## Goals

1. **Consistent workflow across projects** — Install Flight Rules in any project and immediately have a standard way of working. No recreating process from scratch each time.
   - *Measured by:* Setup takes seconds (one CLI command), not minutes

2. **Agent/tool portability** — Work seamlessly across Cursor, Claude Code, and future AI coding tools. Define your workflow once, use it everywhere.
   - *Measured by:* Switching tools requires zero additional configuration

3. **Structured path from requirements to implementation** — A standard flow: capture requirements (PRD) → create implementation specs → break down into trackable tasks.
   - *Measured by:* Every project has a clear PRD → implementation spec → task hierarchy

4. **Preserve context across time and agents** — Session logs, progress tracking, and learnings persist so that any agent, person, or future-you can pick up where things left off.
   - *Measured by:* An agent can resume work after a gap without the user re-explaining context

5. **Documentation reconciliation** — When work happens outside the standard workflow, provide commands to bring documentation back into sync with reality. Also detect when docs have drifted out of sync with each other.
   - *Measured by:* Running `/docs.reconcile` identifies and resolves documentation drift

6. **Easy updates** — Users are notified when a newer CLI version is available and can update with a single command. The update mechanism respects the user's chosen release channel (dev vs latest).
   - *Measured by:* Users running outdated versions see a notification; `flight-rules update` performs the upgrade within their channel

7. **Intelligent version management** — Analyze changes since the last release and recommend appropriate version bumps following semantic versioning conventions.
   - *Measured by:* Running `/version.bump` produces an accurate recommendation based on commit analysis

8. **Project-specific release workflows** — Define and execute release processes tailored to each project's needs, stored as human-readable documentation.
   - *Measured by:* Running `/project.release` follows the steps defined in `docs/release.md`

9. **Implementation verification** — Audit completed tasks to verify that code actually matches what implementation specs claim, catching over-claimed completion, drift, and mismatched implementations.
   - *Measured by:* Running `/impl.validate` identifies discrepancies between specs and code

10. **Parallel dev sessions** — Run multiple AI agents on the same project simultaneously using isolated git worktrees, with automatic session tracking, merge workflows, and cleanup of orphaned sessions.
    - *Measured by:* Running `flight-rules parallel create <name>` creates an isolated worktree; `flight-rules parallel status` shows all active sessions; sessions integrate back via PR, merge, or manual workflow

11. **Planning backlog for idea capture** — Provide a low-friction way to capture half-formed ideas, with commands to clarify, review, and promote them into formal PRD goals and implementation specs.
    - *Measured by:* Capturing an idea takes a single command with no required fields beyond a description; ideas can be clarified, listed, and promoted to the formal workflow

## Non-Goals

1. **Not a project management tool** — Flight Rules doesn't replace Linear, Jira, or GitHub Issues. It's documentation conventions, not a hosted system.

2. **Not prescriptive about tech stack** — Flight Rules doesn't care if you're building in Python, TypeScript, or Rust. It's language/framework agnostic.

3. **Not an AI agent itself** — Flight Rules provides structure *for* agents, but it doesn't execute code or make decisions. The agent does the work; Flight Rules tells it where to look.

4. **Not a CI/CD or automation system** — No automated triggers, webhooks, or pipelines. It's static Markdown files that agents read.

## User Stories

1. **As a developer using AI coding tools**, I want a consistent project structure so that I don't have to re-explain my workflow every time I start a new project or switch tools.

2. **As an AI agent**, I want clear documentation conventions so that I can quickly understand a project's purpose, current state, and what to work on next.

3. **As a developer returning to a project after time away**, I want session logs and progress tracking so that I can pick up where I left off without losing context.

4. **As a team member joining a project**, I want standardized documentation so that I can onboard quickly without someone walking me through everything.

5. **As a developer switching between Cursor and Claude Code**, I want agent-specific adapters so that each tool knows how to find and use the Flight Rules structure.

6. **As an AI agent or CI system**, I want Flight Rules CLI to work without interactive prompts so that I can automate installations and upgrades.

7. **As a developer using AI coding tools**, I want consistent editor settings so that formatting differences (like trailing newlines) don't create phantom uncommitted changes after commits.

8. **As a developer who did work without following the full workflow**, I want to quickly update my documentation to reflect what was actually built, so that my project stays well-documented even when I take shortcuts.

9. **As a developer maintaining a project over time**, I want to detect when my README, PRD, and implementation docs have drifted out of sync, so that I can fix inconsistencies before they cause confusion.

10. **As a developer using Flight Rules**, I want to know when a newer version is available so that I can stay current with improvements and fixes without accidentally switching release channels.

11. **As a developer preparing a release**, I want the agent to analyze my recent commits and recommend whether this should be a major, minor, or patch version bump, so that I follow semantic versioning correctly.

12. **As a developer with a custom release process**, I want to define my release steps once in a readable format, so that any agent can execute the same workflow consistently.

13. **As a developer refining implementation specs**, I want to clarify vague or incomplete task definitions so that the implementation guidance is specific enough to act on.

14. **As a developer preparing for release**, I want to verify that all tasks marked complete actually meet their acceptance criteria, so that I can catch over-claimed or drifted implementations before shipping.

15. **As a developer using multiple AI agents**, I want to run parallel coding sessions in isolated worktrees so that agents don't conflict with each other's file changes.

16. **As a developer ending a parallel session**, I want to choose how to integrate the work (PR, merge, keep, abandon) so that I maintain control over what lands in my main branch.

17. **As a developer using Flight Rules**, I want to quickly stash ideas for future work so that I don't lose them and don't have to formalize them immediately.

18. **As a developer reviewing my backlog**, I want to interactively clarify a rough idea so that it becomes specific enough to act on or promote to the PRD.

## Constraints

1. **Careful handling of user-owned directories** — Flight Rules operates in directories the user also owns (`docs/`, `.cursor/commands/`, and optionally `.editorconfig`). The rules:
   - **Adding new files:** Common and expected (e.g., `prd.create` writes `docs/prd.md`, upgrades add new templates)
   - **Updating existing files:** Rare and requires care. Ideally, detect whether a file has been user-modified vs. left as a template. If unmodified, safe to update; if modified, notify rather than overwrite.
   - **Over-communicate:** Any changes to user-owned directories should be explicit and transparent

2. **CLI distribution via npm** — The package is published to npm with a `dev` tag during pre-1.0 development. Users install with `npm install -g flight-rules@dev`.

3. **Non-interactive mode** — When stdout is not a TTY (CI environments, piped output, agent invocation), CLI commands use safe defaults: skip destructive actions (no reinstall, no overwrite), proceed with non-destructive ones (create new docs, perform upgrades).

## Key Concepts

### Versioning Model

Flight Rules has two distinct versioning concepts:

1. **CLI Version** — The version of the `flight-rules` npm package installed globally or locally. This determines what commands and capabilities are available (`init`, `upgrade`, `adapter`). Tracked in `package.json`.

2. **Payload Version** — The version of Flight Rules *content* deployed into a project's `.flight-rules/` directory. This includes agent guidelines, templates, commands, and prompts. Tracked in `.flight-rules/manifest.json`.

**Why this matters:** A user might have CLI v1.2.0 installed but have deployed payload v0.4.0 into a specific project. The manifest allows projects to know exactly what version of Flight Rules content they're running, independent of what CLI was used to install it.

The `manifest.json` file records:
- `version`: The payload version deployed
- `deployedAt`: When the deployment occurred
- `deployedBy`: What CLI version and command performed the deployment

## Success Criteria

### Primary Measure

**DRY for development workflows** — If Flight Rules is working, the user rarely repeats themselves. Context, workflow instructions, and project knowledge are captured once and reused by any agent, tool, or future session.

### Ultimate Outcome

**Dramatically increased productivity** — Using AI agents to produce high-quality software becomes significantly easier, faster, and more efficient.

### Supporting Indicators

| Goal | Observable Evidence |
|------|---------------------|
| Consistent workflow | `flight-rules init` creates a functional project structure in seconds |
| Agent portability | Adapters exist for multiple tools; switching requires no additional configuration |
| Requirements → Tasks | Projects have a clear path from PRD → implementation specs → tracked tasks |
| Preserve context | Agents can resume work after gaps without user re-explanation |
| Documentation reconciliation | `/docs.reconcile` detects drift and proposes fixes; cross-check identifies inconsistencies |
| Easy updates | Daily version check notifies users of updates; `flight-rules update` upgrades within the user's release channel |
| Intelligent version management | `/version.bump` analyzes commits and recommends correct semver bump |
| Project-specific release workflows | `/project.release` reads `docs/release.md` and executes defined steps |
| Implementation verification | `/impl.validate` audits completed tasks and reports discrepancies with specific evidence |
| Parallel dev sessions | `flight-rules parallel create` isolates sessions; `parallel status` tracks them; merge workflow integrates changes |
| Planning backlog | `/backlog.add` captures an idea in seconds; `/backlog.list` gives a clear overview; `/backlog.promote` feeds a clarified idea into `/feature.add` |
