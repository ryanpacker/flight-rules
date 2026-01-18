# 1. Documentation Reconciliation

Commands for bringing documentation back into sync with project reality when work happens outside the standard workflow.

## Goals

- Detect undocumented work by analyzing git commits since the last documented session
- Update README, PRD, and implementation docs to reflect what was actually built
- Identify and resolve inconsistencies between documentation files
- Support both conversational and one-shot modes

## Key Considerations

- Uses `docs/progress.md` timestamps to identify undocumented work
- Supports explicit scope specification (e.g., "since v0.5.0", "last 10 commits")
- Shows previews before making changes
- Cross-checks documentation for internal consistency

## Task Groups

- **[1.1 README Commands](./1.1-readme-commands.md)** — `readme.create` and `readme.reconcile`
- **[1.2 PRD Reconcile](./1.2-prd-reconcile.md)** — `prd.reconcile` command
- **[1.3 Impl Reconcile](./1.3-impl-reconcile.md)** — `impl.reconcile` command
- **[1.4 Docs Reconcile](./1.4-docs-reconcile.md)** — `docs.reconcile` orchestration and cross-check
