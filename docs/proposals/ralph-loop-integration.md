# Proposal: Ralph Loop Integration

**Status:** Draft
**Author:** Claude
**Date:** 2025-01-17

---

## Executive Summary

Integrate concepts from Ralph — an autonomous AI agent loop system — into Flight Rules to enable automated, iterative task execution with built-in verification and knowledge persistence across agent instances.

---

## Background: What is Ralph?

[Ralph](https://github.com/snarktank/ralph) is an automated development system that executes AI coding tools repeatedly in fresh instances until all product requirements are completed. Key characteristics:

1. **Fresh Context Per Iteration:** Each cycle spawns a new AI session with a clean context window
2. **Small, Focused Tasks:** Each PRD item must fit within one context window
3. **Pass/Fail Tracking:** Stories have explicit `passes: true/false` status
4. **Tight Feedback Loops:** Typecheck, tests, and CI validate each iteration
5. **Knowledge Persistence:** Three mechanisms bridge iterations:
   - Git commits (completed work)
   - `progress.txt` (learnings and context discoveries)
   - `prd.json` (story status tracking)
6. **Termination Condition:** Loop ends when all stories achieve `passes: true`

---

## Problem Statement

Flight Rules provides excellent structure for human-guided AI coding sessions, but lacks support for:

1. **Autonomous iteration** — Running multiple cycles without human intervention
2. **Verification-driven development** — Explicit pass/fail criteria for tasks
3. **Fresh-context resilience** — Ensuring work can continue across AI instance boundaries
4. **Automated progress** — Moving through a backlog systematically

Users who want to "let the AI run overnight" or "work through this list of tasks" currently have no structured way to do so within Flight Rules.

---

## Proposed Solutions

Three distinct approaches, each with different tradeoffs:

| Approach | Granularity | Ralph Similarity | Integration Complexity |
|----------|-------------|-----------------|------------------------|
| Option 1: Task Verification Loop | Individual tasks | Medium | Low |
| Option 2: Session Continuation Mode | Session-sized chunks | High | Medium |
| Option 3: PRD Story Loop | User stories | Highest | Medium-High |

---

## Option 1: Task Verification Loop

### Concept

Add a verification layer to the existing Task system (in `docs/implementation/`) that enables automated iteration through tasks with explicit pass/fail validation.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    TASK VERIFICATION LOOP                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Find next unverified task (status: 🔵 or 🟡)            │
│                          │                                   │
│                          ▼                                   │
│  2. Start minimal session for that task                     │
│                          │                                   │
│                          ▼                                   │
│  3. Implement the task                                      │
│                          │                                   │
│                          ▼                                   │
│  4. Run verification (tests, typecheck, custom command)     │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                       │
│         [PASS]                   [FAIL]                      │
│              │                       │                       │
│              ▼                       ▼                       │
│  5a. Mark task ✅ Complete    5b. Log failure, retry or     │
│      Commit changes               create fix task            │
│              │                       │                       │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│  6. Update progress.md with learnings                       │
│                          │                                   │
│                          ▼                                   │
│  7. Loop until all tasks verified or limit reached          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Task Schema Extension

Current task format:
```markdown
### 1.4.1. Routing Structure

**Goals:** Implement basic routing...

**Status:** 🔵 Planned
```

Extended format with verification:
```markdown
### 1.4.1. Routing Structure

**Goals:** Implement basic routing...

**Status:** 🔵 Planned
**Verified:** false
**Verification:**
- command: `npm test -- --grep "routing"`
- expected: exit code 0
- timeout: 60s
```

### New Commands

#### `/task-loop.start`

```
Usage: /task-loop.start [options]

Options:
  --area <name>       Limit to specific area (e.g., "1-foundation")
  --task-group <id>   Limit to specific task group (e.g., "1.4")
  --max-iterations    Maximum tasks to attempt (default: 10)
  --stop-on-fail      Stop loop on first verification failure
  --dry-run           Show what would be executed without running
```

#### `/task-loop.status`

Shows current loop state:
```
## Task Loop Status

Currently: RUNNING (iteration 3/10)
Current task: 1.4.2 Left Sidebar Implementation

Progress:
  ✅ 1.4.1 Routing Structure (verified in 2m 34s)
  ✅ 1.4.3 Header Component (verified in 1m 12s)
  🟡 1.4.2 Left Sidebar Implementation (in progress)
  🔵 1.4.4 Footer Component (pending)
  🔵 1.4.5 Layout Integration (pending)

Failures: 0
Elapsed: 8m 22s
```

### Persistence Mechanisms

| Ralph Mechanism | Flight Rules Equivalent |
|----------------|-------------------------|
| `prd.json` status | `Verified: true/false` in task specs |
| `progress.txt` | `docs/progress.md` entries |
| Git commits | Commit after each verified task |
| `AGENTS.md` updates | `docs/critical-learnings.md` |

### Advantages

- **Low integration cost:** Extends existing spec system naturally
- **Granular control:** Each task has independent verification
- **Familiar structure:** Uses existing Task hierarchy
- **Human oversight:** Easy to pause, resume, or intervene

### Disadvantages

- **Requires verification commands:** Every task needs explicit verification criteria
- **May not fit all tasks:** Some tasks (documentation, refactoring) are hard to verify automatically
- **Context overhead:** Each task iteration pays context-loading cost

### Implementation Effort

1. Extend task schema to include verification fields
2. Create `/task-loop.start` command
3. Create `/task-loop.status` command
4. Add task iteration logic
5. Integrate with existing progress tracking

---

## Option 2: Session Continuation Mode

### Concept

Enable Flight Rules sessions to run autonomously in sequence, using session logs as the memory bridge between fresh AI instances — most similar to Ralph's architecture.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  SESSION CONTINUATION LOOP                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Read previous session log's "Next Steps" section        │
│                          │                                   │
│                          ▼                                   │
│  2. Pick first actionable item as session goal              │
│                          │                                   │
│                          ▼                                   │
│  3. Start new session (fresh context)                       │
│                          │                                   │
│                          ▼                                   │
│  4. Implement goal                                          │
│                          │                                   │
│                          ▼                                   │
│  5. Run verification (if defined)                           │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                       │
│         [PASS]                   [FAIL]                      │
│              │                       │                       │
│              ▼                       ▼                       │
│  6a. End session normally     6b. Document failure,         │
│      Document next steps          add "fix" to next steps   │
│              │                       │                       │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│  7. Commit changes, update progress.md                      │
│                          │                                   │
│                          ▼                                   │
│  8. Spawn fresh agent instance                              │
│                          │                                   │
│                          ▼                                   │
│  9. Loop until "Next Steps" is empty or limit reached       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Session Log Extension

Current session log template includes a "Next Steps" section. For continuation mode, this becomes the task queue:

```markdown
## Next Steps

Priority items for the next session:

1. **[VERIFY: npm test]** Implement user authentication endpoint
2. **[VERIFY: npm run build]** Add error handling to API routes
3. **[NO-VERIFY]** Update documentation for new endpoints
4. **[BLOCKED: needs design review]** Implement dashboard UI
```

The `[VERIFY: command]` tag defines the verification command. `[NO-VERIFY]` items are marked complete after implementation. `[BLOCKED: reason]` items are skipped.

### New Commands

#### `/continuous-session.start`

```
Usage: /continuous-session.start [options]

Options:
  --max-sessions      Maximum sessions to run (default: 5)
  --require-verify    Only process items with [VERIFY:] tags
  --pause-on-fail     Pause for human review on failure
  --from-session      Start from specific session log file
```

#### `/continuous-session.status`

```
## Continuous Session Status

Mode: RUNNING
Current session: 4 of 5 max
Session log: docs/session_logs/20250117_1400_session.md

Completed this run:
  ✅ Session 1: Implement user authentication endpoint (3m 22s)
  ✅ Session 2: Add error handling to API routes (2m 45s)
  ✅ Session 3: Fix test failures from session 2 (1m 10s)
  🟡 Session 4: Update documentation (in progress)

Remaining in queue:
  - Implement dashboard UI [BLOCKED: needs design review]
```

### The "Fresh Instance" Model

This is where Option 2 most closely mirrors Ralph:

1. **Each session is a fresh AI context** — no accumulated token usage
2. **Session logs are the only memory** — everything important must be written down
3. **Git history provides code continuity** — changes persist via commits
4. **Progress.md tracks the journey** — high-level narrative across sessions

To enable truly fresh instances, the continuation loop could:
- Run as an external script that invokes Claude Code
- Or use Claude Code's agent spawning to create isolated sub-agents

### Persistence Mechanisms

| Ralph Mechanism | Session Continuation Equivalent |
|----------------|--------------------------------|
| `prd.json` status | "Next Steps" queue in session logs |
| `progress.txt` | Session log summaries + progress.md |
| Git commits | Commit at end of each session |
| Fresh instances | New session = new agent context |

### Advantages

- **Closest to Ralph model:** Fresh context per iteration, session logs as memory
- **Leverages existing workflows:** Uses current session start/end commands
- **Natural boundaries:** Sessions are already the unit of work in Flight Rules
- **Rich documentation:** Each iteration produces a full session log

### Disadvantages

- **Coarser granularity:** Sessions are larger than individual tasks
- **Overhead per iteration:** Session setup/teardown takes time
- **Queue management:** "Next Steps" as a queue is less structured than a task list

### Implementation Effort

1. Extend session log template with verification tags
2. Create `/continuous-session.start` command
3. Create session spawning/orchestration logic
4. Add queue parsing from "Next Steps" sections
5. Integrate with existing session commands

---

## Option 3: PRD Story Loop

### Concept

Add Ralph-style `passes: true/false` tracking directly to the PRD's user stories, making the PRD itself the source of truth for what's done and what remains.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      PRD STORY LOOP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load prd-status.json                                    │
│                          │                                   │
│                          ▼                                   │
│  2. Find first story with passes: false                     │
│                          │                                   │
│                          ▼                                   │
│  3. Check if story maps to existing Tasks                   │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                       │
│      [Tasks exist]           [No tasks]                      │
│              │                       │                       │
│              ▼                       ▼                       │
│  4a. Execute via Task Loop   4b. Create tasks first,        │
│                                  then execute                │
│              │                       │                       │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│  5. Run story acceptance criteria                           │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                       │
│         [PASS]                   [FAIL]                      │
│              │                       │                       │
│              ▼                       ▼                       │
│  6a. Mark passes: true       6b. Log failure,               │
│      Commit + update progress     create fix tasks          │
│              │                       │                       │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│  7. Loop until all stories pass or limit reached            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### PRD Status Tracking

Create `docs/prd-status.json` alongside `docs/prd.md`:

```json
{
  "version": 1,
  "lastUpdated": "2025-01-17T14:30:00Z",
  "stories": [
    {
      "id": "US-1",
      "title": "Consistent workflow across projects",
      "passes": true,
      "lastVerified": "2025-01-15T10:00:00Z",
      "verification": {
        "type": "command",
        "command": "flight-rules init && ls .flight-rules/AGENTS.md",
        "expected": "exit 0"
      },
      "implementedBy": ["1.1", "1.2", "1.3"]
    },
    {
      "id": "US-2",
      "title": "Agent/tool portability",
      "passes": false,
      "verification": {
        "type": "manual",
        "criteria": [
          "Cursor adapter works",
          "Claude Code adapter works",
          "Switching requires no config"
        ]
      },
      "implementedBy": ["2.1", "2.2"]
    }
  ]
}
```

### Extended PRD Format

The PRD itself gains acceptance criteria:

```markdown
## User Stories

### US-1: Consistent workflow across projects

**As a** developer using AI coding tools
**I want** a consistent project structure
**So that** I don't have to re-explain my workflow every time

**Acceptance Criteria:**
- [ ] `flight-rules init` completes in under 5 seconds
- [ ] Creates `.flight-rules/` with AGENTS.md
- [ ] Creates `docs/` with prd.md, progress.md
- [ ] Works in empty directory and existing project

**Verification:** `npm test -- --grep "init command"`
```

### New Commands

#### `/story-loop.start`

```
Usage: /story-loop.start [options]

Options:
  --story <id>        Start from specific story (e.g., "US-3")
  --max-stories       Maximum stories to attempt (default: 3)
  --skip-manual       Skip stories with manual verification
  --create-tasks      Auto-create implementation tasks if missing
```

#### `/story-loop.status`

```
## Story Loop Status

Currently: RUNNING
Active story: US-3 (Structured path from requirements to implementation)

PRD Progress:
  ✅ US-1: Consistent workflow across projects
  ✅ US-2: Agent/tool portability
  🟡 US-3: Structured path from requirements to implementation
  🔵 US-4: Preserve context across time and agents
  🔵 US-5: Switching between Cursor and Claude Code

Stories passed: 2/5 (40%)
```

### Story-to-Task Mapping

Stories in the PRD map to Tasks in the implementation specs via the `implementedBy` field:

```json
{
  "id": "US-3",
  "title": "Structured path from requirements to implementation",
  "implementedBy": ["3.1", "3.2", "3.3.1", "3.3.2"]
}
```

When executing a story:
1. If `implementedBy` is populated, execute those tasks (Option 1 style)
2. If empty, prompt to create implementation tasks first
3. After tasks complete, run story-level verification

### Persistence Mechanisms

| Ralph Mechanism | PRD Story Loop Equivalent |
|----------------|--------------------------|
| `prd.json` status | `docs/prd-status.json` |
| `progress.txt` | `docs/progress.md` + `docs/critical-learnings.md` |
| Git commits | Commit after each story passes |
| Story breakdown | `implementedBy` → Task mapping |

### Advantages

- **Most faithful to Ralph:** Pass/fail at the story level matches Ralph's model exactly
- **PRD as source of truth:** Ties implementation directly to requirements
- **Clear completion signal:** All stories passing = project complete
- **Traceability:** Easy to see which tasks implement which stories

### Disadvantages

- **Highest complexity:** Requires PRD extensions, status file, task mapping
- **Story granularity may be too coarse:** Stories often span many tasks
- **Manual verification:** Many stories require human judgment
- **Dual tracking:** Must keep prd-status.json and task statuses in sync

### Implementation Effort

1. Create `docs/prd-status.json` schema and initial file
2. Extend PRD template with acceptance criteria format
3. Create story-to-task mapping system
4. Create `/story-loop.start` command
5. Create `/story-loop.status` command
6. Integrate with Task system for execution

---

## Comparison Matrix

| Aspect | Option 1: Task Loop | Option 2: Session Loop | Option 3: Story Loop |
|--------|---------------------|------------------------|----------------------|
| **Granularity** | Individual tasks | Session-sized chunks | User stories |
| **Ralph Similarity** | Medium | High | Highest |
| **Integration Effort** | Low | Medium | High |
| **Verification Precision** | High (per task) | Medium (per session) | Variable (per story) |
| **Human Oversight** | Easy to intervene | Per-session checkpoints | Story-level gates |
| **Context Efficiency** | Some overhead | Fresh per session | Depends on story size |
| **Existing Workflow Fit** | Extends specs | Extends sessions | Extends PRD |
| **Automation Potential** | High | Very High | Medium-High |

---

## Recommendation

**Start with Option 2 (Session Continuation Mode)** for these reasons:

1. **Best philosophical fit:** Flight Rules is session-oriented; Ralph is iteration-oriented. Sessions are natural iteration boundaries.

2. **Minimal new concepts:** Uses existing session logs, progress.md, and session commands. No new schema required.

3. **Fresh-context model:** Actually achieves Ralph's key insight — fresh AI instances with documented memory bridges.

4. **Incremental adoption:** Can add task-level verification (Option 1) or story tracking (Option 3) later as refinements.

5. **Practical value:** Users can "let it run overnight" with session-level checkpoints and clear documentation of each iteration.

### Suggested Implementation Order

1. **Phase 1:** Session Continuation Mode (Option 2)
   - Verification tags in session logs
   - `/continuous-session.start` command
   - Basic orchestration

2. **Phase 2:** Task Verification (Option 1 elements)
   - Add `Verified:` field to tasks
   - Task-level verification within sessions
   - `/task-loop.start` for finer control

3. **Phase 3:** Story Tracking (Option 3 elements)
   - `prd-status.json` for high-level progress
   - Story-to-task mapping
   - Completion metrics

---

## Open Questions

1. **How should the loop be orchestrated?**
   - External script that invokes Claude Code?
   - Claude Code agent spawning sub-agents?
   - User manually runs `/continuous-session.start` in each new terminal?

2. **What's the right failure handling?**
   - Retry N times then pause?
   - Always pause for human review?
   - Create a "fix" task and continue?

3. **How do we handle tasks that can't be verified automatically?**
   - Skip them in autonomous mode?
   - Require human sign-off?
   - Trust the AI's self-assessment?

4. **Should loops be interruptible and resumable?**
   - Pause mid-loop and resume later?
   - How to persist loop state?

5. **How does this interact with parallel sessions (see parallel-sessions.md)?**
   - Multiple loops running in parallel?
   - Loops in worktrees?

---

## References

- [Ralph on GitHub](https://github.com/snarktank/ralph)
- [Parallel Sessions Proposal](./parallel-sessions.md)
- [Flight Rules AGENTS.md](../.flight-rules/AGENTS.md)
