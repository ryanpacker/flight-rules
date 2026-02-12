# Promote Backlog Item

When the user invokes "backlog.promote", graduate a backlog idea into the formal PRD and implementation workflow by feeding it into `/feature.add`.

## 1. Find the Backlog Item

If the user provided an identifier with the command (e.g., "/backlog.promote dark-mode"), search `docs/backlog/` for a matching file:

- Try exact filename match first: `docs/backlog/[identifier].md`
- Then try with `.md` appended: `docs/backlog/[identifier].md`
- Then try partial match against filenames in `docs/backlog/`

If no identifier was provided, list the files in `docs/backlog/` (excluding `archive/`) and ask:

> "Which backlog item would you like to promote to a full feature?"
>
> [numbered list of items with their Status]

Wait for the user to select one.

**If no match found:**

> "I couldn't find a backlog item matching '[identifier]'. Run `/backlog.list` to see all items."

Stop.

## 2. Read and Present the Item

Read the matched file. Present the content:

> **Promoting: [Title]**
> - **Status**: [Raw/Clarified]
> - **Idea**: [quote the Idea section]
> - **Problem**: [quote if present]
> - **Possible Approach**: [quote if present]

If the item is Raw (not yet Clarified):

> "This idea hasn't been clarified yet. Promoting a Raw item is fine, but you'll get better results if you clarify it first.
>
> Would you like to:
> 1. **Clarify first** — Run `/backlog.clarify` to flesh it out
> 2. **Promote as-is** — Proceed with the raw idea"

Wait for the user's response. If they choose to clarify first, stop and let them run `/backlog.clarify`.

## 3. Launch Feature Add Workflow

Feed the backlog item's content into the `/feature.add` workflow as context. Present it as:

> "I'll now run the feature addition workflow using this backlog item as the starting point."

Proceed to follow the full `/feature.add` process (from `feature.add.md`), using the backlog item's description, problem statement, and approach as the feature description input. This means:

1. Check prerequisites (PRD exists, implementation outline exists)
2. Gather context from existing docs
3. Skip the "what feature?" question — use the backlog item as the answer
4. Continue with understanding, placement, PRD updates, implementation updates, etc.

The agent should follow the full `feature.add.md` workflow from Step 4 onward, treating the backlog item content as the user's feature description.

## 4. Archive the Backlog Item

After the `/feature.add` workflow completes successfully (PRD and implementation updates applied):

Ensure `docs/backlog/archive/` exists (create if needed).

Update the backlog file:
- Change Status to **Promoted**
- Add a **Promoted To** field with references to where the idea landed

```markdown
**Status**: Promoted
**Promoted To**: PRD Goal [N], Implementation [area/spec reference]
```

Move the file from `docs/backlog/` to `docs/backlog/archive/`.

## 5. Confirm

> "Promoted and archived: `docs/backlog/archive/[filename].md`
>
> **What was created:**
> - PRD Goal [N]: [brief description]
> - Implementation spec: `[path to spec file]`
>
> **Next steps:**
> - `/impl.create` or `/impl.clarify` to add detail to the new spec
> - `/dev-session.start` to begin implementing
> - `/backlog.list` to see remaining backlog items"

## Key Behaviors

- **Recommend clarifying first** — Raw items work, but Clarified items produce better features.
- **Reuse `/feature.add` fully** — Don't reinvent the feature addition workflow. Follow `feature.add.md` for the actual PRD/implementation work.
- **Archive, don't delete** — Promoted items move to `docs/backlog/archive/` so there's a record.
- **Cross-reference** — The archived file should say where the idea ended up (PRD goal number, implementation area).
- **Don't modify the original idea** — The Idea section stays as-is, even in the archived version.
