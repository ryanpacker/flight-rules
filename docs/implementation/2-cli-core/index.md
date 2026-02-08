# 2. CLI Core

The Flight Rules command-line interface, distributed via npm.

## Goals

- Provide simple commands for installing and managing Flight Rules in projects
- Support both interactive and non-interactive (CI/agent) modes
- Track payload versions via manifest.json
- Generate agent-specific adapter files

## Key Considerations

- CLI is written in TypeScript, compiled to JavaScript
- Distributed via npm with `dev` tag during pre-1.0 development
- Must handle user-owned directories carefully (docs/, adapters)
- Non-interactive mode uses safe defaults

## Task Groups

- **[2.1 Init Command](./2.1-init-command.md)** — Install Flight Rules into a project
- **[2.2 Upgrade Command](./2.2-upgrade-command.md)** — Upgrade Flight Rules in existing projects
- **[2.3 Adapter Command](./2.3-adapter-command.md)** — Generate agent-specific adapters
- **[2.4 Utility Functions](./2.4-utility-functions.md)** — Shared utilities for file operations and prompts
- **[2.5 Update Command](./2.5-update-command.md)** — Check for and install CLI updates
- **[2.6 Parallel Sessions](./2.6-parallel-sessions.md)** — Manage parallel dev sessions with git worktrees

## Status

🟡 In Progress — Core CLI commands complete. Parallel sessions (2.6) newly added.
