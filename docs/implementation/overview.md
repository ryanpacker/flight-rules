# Implementation Overview

This document lists the major implementation areas for this project.

## Implementation Areas

1. **Documentation Reconciliation** — Commands for syncing documentation with project reality
   - Status: ✅ Complete
   - See: `1-documentation-reconciliation/`

2. **CLI Core** — The Flight Rules command-line interface
   - Status: 🟡 In Progress
   - See: `2-cli-core/`

3. **Workflow Commands** — Prompt-based commands for AI agents
   - Status: ✅ Complete
   - See: `3-workflow-commands/`

## Historical Specs

These documents capture design decisions for specific features:

- [editorconfig.md](./editorconfig.md) — EditorConfig installation feature
- [manifest-versioning.md](./manifest-versioning.md) — Manifest.json versioning system

## How to Use This

1. Each numbered area has its own directory: `{N}-{kebab-topic}/`
2. Inside each directory:
   - `index.md` – Overview and goals for that area
   - `{N}.{M}-topic.md` – Detailed specs for sub-areas
3. Status is tracked in the detailed spec files, not here


