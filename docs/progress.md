# Progress

A running log of sessions and milestones.

---

## Session Logs

### 2026-01-25

- Added "Spec Evolution (No Version History)" guidelines to AGENTS.md
- Clarifies that implementation specs describe current state, not version history
- Directs change history to Git commits, session logs, and progress.md

### 2026-01-24

- Added `flight-rules ralph` command for autonomous agent loops
- Ralph spawns fresh Claude Code instances to work through task groups unattended
- Created `ralph-loop.md` prompt with quality check discovery and verbose logging
- Added `--area` flag to target specific implementation areas
- Added `--branch` flag to create new git branch before starting (with auto-generation)
- Added 16 new tests (186 total, all passing)
- See: [session_logs/20260124_session.md](session_logs/20260124_session.md)

### 2026-01-23

- Added `agents-md.refine` command for refactoring AGENTS.md using progressive disclosure
- Command guides through: finding contradictions, extracting essentials, grouping into category files, flagging deletions
- See: [session_logs/20260123_session.md](session_logs/20260123_session.md)

### 2026-01-17 21:00

- Added `impl.clarify` command for refining existing implementation specs
- Updated `feature.add` to recommend both `impl.create` and `impl.clarify`
- Added user story 13 to PRD
- See: [session_logs/20260117_2100_session.md](session_logs/20260117_2100_session.md)

### 2026-01-17 20:46

- Added `version.bump` and `project.release` features to PRD (Goals 7-8)
- Created implementation spec `3.7-release-commands.md`
- Implemented `version.bump` command (Task 3.7.1)
- Command supports one-shot mode (`version.bump patch`) and conversational mode (analyze commits, recommend bump)
- See: [session_logs/20260117_2046_session.md](session_logs/20260117_2046_session.md)

### 2026-01-17

- Implemented update command feature (Task Group 2.5)
- Created user-level config at `~/.flight-rules/config.json`
- Added version check with 24-hour caching against npm registry
- Added passive update notification after CLI commands
- Created `flight-rules update` command with `--channel` flag
- Added 40 new tests (170 total, all passing)
- See: [session_logs/20260117_session.md](session_logs/20260117_session.md)

### 2026-01-10 22:30

- Published `flight-rules` v0.5.9 to npm registry
- Package installable via `npm install -g flight-rules@dev`
- Added early development banner to README
- Updated installation docs from GitHub tarball to npm
- See: [session_logs/20260110_2230_session.md](session_logs/20260110_2230_session.md)

### 2025-01-07 16:00

- Added native slash command support for Claude Code adapter
- Claude adapter now creates `.claude/commands/` with command files (like Cursor's `.cursor/commands/`)
- `CLAUDE.md` now references `/dev-session.start` and `/dev-session.end` slash commands
- Added 12 new tests (130 total, all passing)
- See: [session_logs/20250107_1600_session.md](session_logs/20250107_1600_session.md)

### 2024-12-31 (evening)

- Created `prd.create` command with dual-mode support (conversational + one-shot)
- Created `prd.clarify` command for refining specific PRD sections
- Updated prompts README to reference new commands
- Inspired by Spec Kit and ChatPRD patterns
- See: [session_logs/20251231_2140_session.md](session_logs/20251231_2140_session.md)

### 2024-12-31

- Implemented comprehensive testing strategy with Vitest
- Added 89 unit tests achieving 93% overall code coverage
- Full coverage: `files.ts` (100%), `init.ts` (98.5%), `upgrade.ts` (100% lines)
- Established mocking patterns for fs, network (fetch), and @clack/prompts
- Added npm scripts: `test`, `test:watch`, `test:coverage`
- See: [session_logs/20251231_1200_session.md](session_logs/20251231_1200_session.md)

### 2024-12-29

- Moved `docs/` from inside `.flight-rules/` to project root in destination projects
- Added conflict handling for existing `docs/` directories during init
- Simplified upgrade framing: `.flight-rules/` = framework (replaceable), `docs/` = yours (untouched)
- Updated all documentation and CLI code
- See: [session_logs/20251229_session.md](session_logs/20251229_session.md)


