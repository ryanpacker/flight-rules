# List Backlog

When the user invokes "backlog.list", show a summary of all backlog items.

## 1. Read Backlog Items

Read all Markdown files in `docs/backlog/` (excluding the `archive/` subdirectory).

If `docs/backlog/` doesn't exist or contains no files:

> "No backlog items found. Run `/backlog.add` to capture your first idea."

Stop.

## 2. Parse Each Item

For each file, extract the frontmatter fields:
- **Title** — from the `# Title` heading
- **Status** — Raw, Clarified, or Promoted
- **Tags** — if present
- **Priority** — if present
- **Captured** — the date

## 3. Apply Filters (Optional)

If the user provided filters with the command (e.g., "/backlog.list clarified" or "/backlog.list tag:api"), apply them:

- **By status**: Show only items matching the given status (Raw, Clarified)
- **By tag**: Show only items with the given tag
- **By priority**: Show only items with the given priority

If no filters, show all items.

## 4. Present the List

Display items sorted by capture date (newest first):

> **Backlog** — [N] items: [X] Raw, [Y] Clarified
>
> | # | Title | Status | Tags | Priority | Captured |
> |---|-------|--------|------|----------|----------|
> | 1 | [Title] | Raw | | | 2026-02-11 |
> | 2 | [Title] | Clarified | api, auth | High | 2026-02-10 |
> | ... | | | | | |

- Leave Tags and Priority blank in the table when not set (don't show "none" or "—")
- If there are archived items, mention the count at the bottom

If there are archived items in `docs/backlog/archive/`:

> _[N] promoted items in archive/_

## 5. Suggest Next Actions

> **Actions:**
> - `/backlog.add` — Capture a new idea
> - `/backlog.clarify [title]` — Flesh out a Raw item
> - `/backlog.promote [title]` — Move a Clarified item into the PRD workflow

## Key Behaviors

- **Quick scan, not deep read** — Extract only the header fields, don't analyze the full content.
- **Graceful with missing fields** — Tags and Priority will often be blank. Don't treat that as an error.
- **Newest first** — Most recent ideas are most relevant.
- **Exclude archive** — Promoted items live in `docs/backlog/archive/` and shouldn't clutter the active list.
