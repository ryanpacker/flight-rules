# Flight Rules – Cursor Adapter

This file is placed at the project root as `AGENTS.md` for Cursor compatibility.

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
| Session Commands | `.flight-rules/commands/` |

## For Agents

Please read `.flight-rules/AGENTS.md` for complete guidelines on:
- Project structure
- Implementation specs
- Coding sessions
- How to work with this system

When the user says "start coding session" or "end coding session", follow the instructions in `.flight-rules/commands/`.

---

## ⚠️ CRITICAL: This Is the Flight Rules Repository

**This project IS Flight Rules itself.** There are two directories that look similar but serve completely different purposes:

### `payload/` — The Source Templates (What Gets Distributed)

This is the **source code** for what gets installed into OTHER projects when they run `flight-rules init`. 

- Changes here affect what USERS of Flight Rules receive
- This is framework code, not project documentation
- Treat this as product source code

### `docs/` and `.flight-rules/` — The Installed Instance (For This Project)

This is a **normal Flight Rules installation** used to manage the development of Flight Rules itself (dogfooding).

- `docs/` contains documentation for THIS project's development
- Session logs, progress, PRD, and specs here are about building Flight Rules
- `.flight-rules/` contains framework files (AGENTS.md, commands, prompts, doc-templates)

### The Rule

| If you're changing... | Edit in... |
|----------------------|------------|
| What users receive when they install Flight Rules | `payload/` |
| Documentation about Flight Rules development | `docs/` |
| Agent guidelines that ship to users | `payload/AGENTS.md` |
| Session logs, progress, specs for THIS project | `docs/` |

**When in doubt:** Ask yourself "Am I changing the product, or documenting work on the product?"
