# Flight Rules – AGENTS Adapter

This file is placed at the project root as `AGENTS.md` for Codex and Cursor compatibility.

---

**This project uses Flight Rules.**

Agent guidelines and workflows live in `.flight-rules/`. Project documentation lives in `docs/`.

## Quick Reference

| What | Where |
|------|-------|
| Agent Guidelines | `.flight-rules/AGENTS.md` |
| PRD | `docs/prd.md` |
| Implementation Specs | `docs/implementation/` |
| Progress Log | `docs/progress.md` |
| Tech Stack | `docs/tech-stack.md` |
| Workflow Commands | `.flight-rules/commands/` |
| Cursor Slash Commands | `.cursor/commands/` (if installed) |
| Codex Skills | `.agents/skills/` (if installed) |

## For Agents

Please read `.flight-rules/AGENTS.md` for complete guidelines on:
- Project structure
- Implementation specs
- Coding sessions
- How to work with this system

`.flight-rules/commands/` is the source of truth for Flight Rules workflows.
If Cursor slash commands are installed, you can use the mirrored command files in `.cursor/commands/`.
If Codex skills are installed, use the matching Flight Rules skill in `.agents/skills/`.
When the user asks to "start coding session" or "end coding session", follow the corresponding workflow in `.flight-rules/commands/`.
