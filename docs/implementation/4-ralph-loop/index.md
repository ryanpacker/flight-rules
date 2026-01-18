# Area 4: Ralph Loop Integration

## Overview

This area covers the integration of Ralph-style autonomous iteration capabilities into Flight Rules. Ralph is an automated development system that executes AI coding tools repeatedly in fresh instances until all tasks are completed.

## Goals

1. **Enable autonomous iteration** — Allow AI agents to work through multiple tasks without constant human intervention
2. **Verification-driven development** — Explicit pass/fail criteria for tasks and sessions
3. **Fresh-context resilience** — Ensure work continues seamlessly across AI instance boundaries
4. **Automated progress** — Systematic movement through backlogs with clear completion signals

## Architecture

The integration follows a phased approach, implementing three complementary systems:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RALPH LOOP INTEGRATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: Session Continuation Mode (Foundation)                    │
│  ├── Verification tags in session logs                              │
│  ├── continuous-session.start command                               │
│  ├── continuous-session.status command                              │
│  └── Session orchestration logic                                    │
│                                                                      │
│  Phase 2: Task Verification Layer (Refinement)                      │
│  ├── Extended task schema with Verified: field                      │
│  ├── task-loop.start command                                        │
│  ├── task-loop.status command                                       │
│  └── Task iteration within sessions                                 │
│                                                                      │
│  Phase 3: Story-Level Tracking (Completion)                         │
│  ├── prd-status.json schema and generation                          │
│  ├── Story-to-task mapping system                                   │
│  ├── story-loop.start command                                       │
│  └── Completion metrics and reporting                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Why Session Continuation First (Phase 1)

1. **Best philosophical fit** — Flight Rules is session-oriented; sessions are natural iteration boundaries
2. **Minimal new concepts** — Uses existing session logs, progress.md, and session commands
3. **Fresh-context model** — Actually achieves Ralph's key insight of fresh AI instances with documented memory bridges
4. **Foundation for later phases** — Task and story verification build on top of session infrastructure

### Persistence Mechanisms

| Ralph Concept | Flight Rules Implementation |
|---------------|----------------------------|
| `prd.json` story status | Phase 1: Next Steps queue in session logs |
|                         | Phase 2: `Verified:` field in tasks |
|                         | Phase 3: `docs/prd-status.json` |
| `progress.txt` learnings | `docs/progress.md` + `docs/critical-learnings.md` |
| Git commits | Commit at session/task completion |
| Fresh instances | New session = new agent context (orchestrator spawns fresh) |

### Orchestration Model

Two supported modes:
1. **Internal** — Claude Code agent spawning sub-agents with Task tool
2. **External** — Script/wrapper that invokes Claude Code CLI repeatedly

## Task Groups

- [4.1 Session Continuation Mode](./4.1-session-continuation.md) — Phase 1 core implementation
- [4.2 Task Verification Layer](./4.2-task-verification.md) — Phase 2 task-level verification
- [4.3 Story Tracking](./4.3-story-tracking.md) — Phase 3 PRD-level tracking
- [4.4 Orchestration](./4.4-orchestration.md) — Cross-cutting orchestration concerns

## Dependencies

- Existing session commands (dev-session.start, dev-session.end)
- Session log template
- Implementation spec system (Tasks, Task Groups, Areas)
- Progress tracking (docs/progress.md)

## Success Criteria

- Users can "let it run overnight" and come back to meaningful progress
- Each iteration produces clear documentation of what was done
- Failures are logged with enough context to debug
- Human oversight is easy at any checkpoint
- The system gracefully handles tasks that can't be auto-verified

## Status

**Status: 🔵 Planned**
