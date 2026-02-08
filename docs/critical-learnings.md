# Critical Learnings

A curated list of important insights, patterns, and decisions that should inform future work.

---

## Architecture

### Keep upgrade boundaries at the top level

**Context:** When deciding whether `docs/` should live inside `.flight-rules/` or at the project root.

**Insight:** Distinguishing "replaceable on upgrade" vs "user-owned" content is cleaner when the boundary is at the directory level rather than between subdirectories. Having both `doc-templates/` (replaceable) and `docs/` (user-owned) inside the same parent directory was confusing.

**Implication:** When designing directory structures with mixed ownership, prefer separating concerns at the highest practical level. Users should be able to think "this whole directory is mine" or "this whole directory is framework."

---

## CLI Patterns

### npm registry provides dist-tags for version checking

**Context:** Implementing version check for CLI update notifications.

**Insight:** The npm registry at `https://registry.npmjs.org/{package}` returns a `dist-tags` object containing all tagged versions (e.g., `dev`, `latest`). This is the canonical way to check what version is available on a specific release channel without parsing the full versions list.

**Implication:** For CLI tools that support multiple release channels, fetch the registry metadata once and read the appropriate dist-tag rather than trying to infer channel from version numbers.

### Extract shared git helpers when patterns repeat

**Context:** Both `ralph.ts` and `parallel.ts` implement nearly identical `runGitCommand` helpers for spawning git subprocesses.

**Insight:** When the same spawn+promise pattern for running shell commands appears in multiple command files, it's a signal to extract to a shared utility (e.g., `src/utils/git.ts`). The current duplication is tolerable at two commands but should be consolidated before a third command needs it.

**Implication:** Watch for repeated subprocess patterns across commands. A shared `runGitCommand` utility would reduce duplication and ensure consistent error handling.

### User-level config for cross-project CLI state

**Context:** Deciding where to store version check cache and release channel preference.

**Insight:** For state that should persist across all projects (like "when did I last check for updates"), use a user-level config directory (`~/.{toolname}/`) rather than project-level config. This prevents redundant operations (one check per day total, not per project) and keeps user preferences consistent.

**Implication:** Distinguish between project-specific config (lives in the project) and user-specific config (lives in home directory). Version check caches, auth tokens, and global preferences belong in user-level config.
