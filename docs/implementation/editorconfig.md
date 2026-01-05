# EditorConfig Feature

## Goal

Reduce friction from editor inconsistencies by optionally installing a standard `.editorconfig` file into target projects. This prevents phantom uncommitted changes caused by editors adding trailing newlines or other formatting differences after commits.

## Behavior

### During `init`

1. After the adapter generation prompt, ask: "Would you like to add a standard .editorconfig?"
2. If `.editorconfig` already exists in the project root, skip entirely (no prompt, no overwrite)
3. If user agrees, copy `payload/.editorconfig` to project root

### Non-Interactive Mode

Skip `.editorconfig` installation entirely. This is a safe default because:
- Users may already have their own `.editorconfig` with project-specific settings
- The file goes in the project root (user-owned space)
- Users can manually copy the file if desired

### Upgrade Behavior

The `upgrade` command does NOT touch `.editorconfig`. Once installed, it's user-owned and user-managed.

## Payload File

Location: `payload/.editorconfig`

### Configuration Scope

The payload file includes only non-opinionated baseline settings:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `insert_final_newline` | `true` | Prevents phantom diffs from editors adding newlines |
| `end_of_line` | `lf` | Consistent line endings across platforms |
| `charset` | `utf-8` | Universal encoding standard |
| `trim_trailing_whitespace` | `true` | Reduces noise in diffs |

### Intentionally Omitted

- `indent_style` — Varies by language and team preference
- `indent_size` — Varies by language and team preference

### Markdown Exception

Markdown files (`*.md`) have `trim_trailing_whitespace = false` because trailing spaces can be meaningful (line breaks).

## Implementation

### Files Changed

| File | Change |
|------|--------|
| `payload/.editorconfig` | New payload file with baseline config |
| `src/commands/init.ts` | Add optional editorconfig installation prompt |
| `tests/commands/init.test.ts` | Add tests for new behavior |

### Code Changes in `init.ts`

After the adapter generation section, add:

1. Check if `.editorconfig` exists in project root
2. If exists: skip silently
3. If interactive mode: prompt user
4. If user agrees: copy `payload/.editorconfig` to project root
5. If non-interactive: skip silently

