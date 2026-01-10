# Flight Rules Project – Local Agent Guidelines

This file contains project-specific instructions that extend `.flight-rules/AGENTS.md`.

---

## Critical: This is a Meta-Project

**Flight Rules uses Flight Rules on itself.** This creates two distinct sets of files:

| Purpose | Location | When to Edit |
|---------|----------|--------------|
| **Source files** (distributed to other projects) | `payload/` | When changing Flight Rules itself |
| **Installed files** (used by this project) | `.flight-rules/`, `.claude/commands/`, `.cursor/commands/` | Almost never – these are outputs |

### The Rule

**When modifying Flight Rules commands, templates, or agent guidelines:**
- Edit files in `payload/` (the authoritative source)
- Do NOT edit files in `.claude/commands/`, `.cursor/commands/`, or `.flight-rules/`

The files outside `payload/` are installed copies for using Flight Rules on the Flight Rules project itself. They get overwritten during upgrades.

### Examples

| Task | Correct File | Wrong File |
|------|--------------|------------|
| Update `/impl.create` command | `payload/commands/impl.create.md` | `.claude/commands/impl.create.md` |
| Change agent guidelines | `payload/AGENTS.md` | `.flight-rules/AGENTS.md` |
| Modify PRD template | `payload/doc-templates/prd.md` | `.flight-rules/doc-templates/prd.md` |

---

## Project-Specific Notes

- The CLI source code is in `src/`
- Run `npm run build` to compile
- Run `npm test` to run tests
- The `manifest.json` in `.flight-rules/` and `payload/` tracks versions
