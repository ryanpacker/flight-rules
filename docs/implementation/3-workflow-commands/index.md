# 3. Workflow Commands

Prompt-based commands that AI agents execute to follow Flight Rules workflows.

## Goals

- Provide structured workflows for common development tasks
- Support both conversational and one-shot modes
- Guide agents through requirements, implementation, and documentation
- Maintain consistency across different AI coding tools

## Key Considerations

- Commands are Markdown files containing prompts, not executable code
- Agents read and follow the instructions in these files
- All commands live in `payload/commands/` and get copied to `.flight-rules/commands/`
- Claude Code also gets copies in `.claude/commands/` for slash command access

## Task Groups

- **[3.1 PRD Commands](./3.1-prd-commands.md)** — Create and refine Product Requirements Documents
- **[3.2 Implementation Commands](./3.2-implementation-commands.md)** — Create implementation outlines and detailed specs
- **[3.3 Session Commands](./3.3-session-commands.md)** — Start and end structured coding sessions
- **[3.4 Testing Commands](./3.4-testing-commands.md)** — Add tests and assess test coverage
- **[3.5 Feature Command](./3.5-feature-command.md)** — Add features to existing projects
- **[3.6 Prompt Command](./3.6-prompt-command.md)** — Refine and improve prompts

## Status

✅ Complete — All workflow commands are implemented.

## Note

Documentation reconciliation commands (`readme.*`, `prd.reconcile`, `impl.reconcile`, `docs.reconcile`) are covered in [Area 1: Documentation Reconciliation](../1-documentation-reconciliation/).
