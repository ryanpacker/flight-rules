# Clarify Backlog Item

When the user invokes "backlog.clarify", help them flesh out a raw idea through interactive conversation. The goal is to add enough structure that the idea becomes actionable — without over-formalizing it.

## 1. Find the Backlog Item

If the user provided an identifier with the command (e.g., "/backlog.clarify dark-mode"), search `docs/backlog/` for a matching file:

- Try exact filename match first: `docs/backlog/[identifier].md`
- Then try with `.md` appended: `docs/backlog/[identifier].md`
- Then try partial match against filenames in `docs/backlog/`

If no identifier was provided, list the files in `docs/backlog/` (excluding `archive/`) and ask:

> "Which backlog item would you like to clarify?"
>
> [numbered list of items with their Status]

Wait for the user to select one.

**If no match found:**

> "I couldn't find a backlog item matching '[identifier]'. Run `/backlog.list` to see all items, or `/backlog.add` to create a new one."

Stop.

**If multiple matches found:**

> "I found multiple items matching '[identifier]':
>
> [numbered list of matching items]
>
> Which one did you mean?"

Wait for the user to select one.

## 2. Read the Current Item

Read the matched file. Note the current status and content.

Present a summary:

> **Current item: [Title]**
> - **Status**: [Raw/Clarified]
> - **Idea**: [quote the Idea section]

If the item is already Clarified:

> "This item has already been clarified. Would you like to refine it further, or is it ready to promote with `/backlog.promote`?"

If the user wants to refine further, continue. Otherwise, stop.

## 3. Ask Clarifying Questions

Ask 3-5 targeted questions to draw out more detail. Choose from these categories based on what's missing:

**Problem understanding:**
- "What problem does this solve? Who experiences this problem?"
- "How are you (or users) working around this today?"
- "What happens if we never build this?"

**Scope and approach:**
- "What's the simplest version of this that would be useful?"
- "Are there parts of this that could be separate ideas?"
- "Do you have a rough sense of how this would work technically?"

**Constraints and dependencies:**
- "Does this depend on anything else being built first?"
- "Are there constraints (time, tech, compatibility) to keep in mind?"
- "Does this conflict with or overlap with any existing features?"

**Priority signals:**
- "How important is this relative to what you're working on now?"
- "Is this a 'nice to have' or a 'need to have'?"

Ask questions conversationally — 1-2 at a time, not all at once. Adapt follow-ups based on the user's answers.

## 4. Update the File

After the conversation, update the backlog file with the new detail. Preserve the original Idea section and add new sections below it:

```markdown
# [Title]

**Captured**: [original date]
**Status**: Clarified
**Tags**: [add if the conversation revealed natural tags]
**Priority**: [add if the user indicated priority]

## Idea

[Original idea text — preserved as-is]

## Problem

[What problem this solves and who it affects]

## Possible Approach

[How this might be implemented, at a high level]

## Open Questions

- [Unresolved questions from the conversation]

## Notes

[Any other relevant context from the conversation]
```

**Rules for updating:**
- Change Status from Raw → Clarified
- Preserve the original Idea text exactly
- Only add Tags/Priority if the conversation naturally surfaced them — don't ask just to fill fields
- Omit sections that have no content (e.g., skip Open Questions if there are none)

Show the user a preview of the updated content before writing:

> "Here's the clarified version. Does this capture everything, or would you like to adjust anything?"

Wait for confirmation before writing.

## 5. Confirm

> "Updated: `docs/backlog/[filename].md`
>
> **Next steps:**
> - `/backlog.promote [filename]` — Move this into the PRD and implementation workflow
> - `/backlog.clarify [another-item]` — Clarify another idea
> - `/backlog.list` — See all backlog items"

## Key Behaviors

- **Preserve the original idea** — Never modify the Idea section. Add new sections below it.
- **Conversational, not interrogative** — Ask 1-2 questions at a time, not a checklist.
- **Don't over-formalize** — This is a backlog item, not a spec. Keep it concise.
- **Surface priority naturally** — If the user's answers suggest priority, note it. Don't force a ranking exercise.
- **Preview before writing** — Always show the updated content and wait for confirmation.
