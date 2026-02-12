# Add to Backlog

When the user invokes "backlog.add", capture an idea with minimum friction. This command prioritizes speed — the user should go from thought to captured file in seconds.

## 1. Determine Mode

**One-shot mode (primary):** If the user provided a description with the command (e.g., "/backlog.add dark mode for settings page"), proceed directly to Step 3 using that text as the idea description.

**Conversational mode:** If the user invoked the command without a description:

> "What idea would you like to capture? Just describe it in a sentence or two — we can flesh it out later with `/backlog.clarify`."

Wait for the user's response.

## 2. Gather Title

If the user provided a one-shot description, derive a concise title from it (5-8 words max).

If in conversational mode and the description is long or complex, ask:

> "Got it. What would you call this in a few words? (This becomes the filename.)"

If the description is short enough to serve as the title, use it directly — don't ask.

## 3. Check for Duplicates

Convert the title to kebab-case for the filename (e.g., "Dark Mode for Settings" → `dark-mode-for-settings.md`).

Check if `docs/backlog/` contains a file with the same or very similar name.

If a duplicate exists:

> "There's already a backlog item with a similar name: `docs/backlog/[existing-file]`. Would you like to:
> 1. **Add anyway** — Create a new file with a slightly different name
> 2. **View existing** — Open the existing item instead
> 3. **Cancel** — Skip this capture"

Wait for the user's response.

## 4. Create the Backlog File

Ensure `docs/backlog/` exists (create it if needed).

Create the file at `docs/backlog/[kebab-case-title].md` with this template:

```markdown
# [Title]

**Captured**: [YYYY-MM-DD]
**Status**: Raw
**Tags**:
**Priority**:

## Idea

[User's description]
```

- Use today's date for the Captured field
- Tags and Priority are left blank intentionally — they're optional
- The Idea section contains the user's description as-is, without editing or expanding it

## 5. Confirm

> "Captured: `docs/backlog/[filename].md`
>
> **Next steps when you're ready:**
> - `/backlog.clarify [filename]` — Flesh out this idea with more detail
> - `/backlog.list` — See all your backlog items
> - `/backlog.add` — Capture another idea"

## Key Behaviors

- **Speed over completeness** — Don't ask unnecessary questions. Title + description is enough.
- **No required fields beyond description** — Tags and priority are always optional and left blank at capture time.
- **Don't embellish** — Write the user's idea as they described it. Don't add your own analysis or suggestions.
- **Create the directory if needed** — `docs/backlog/` may not exist yet.
