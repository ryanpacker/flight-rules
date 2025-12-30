# Critical Learnings

A curated list of important insights, patterns, and decisions that should inform future work.

---

## Architecture

### Keep upgrade boundaries at the top level

**Context:** When deciding whether `docs/` should live inside `.flight-rules/` or at the project root.

**Insight:** Distinguishing "replaceable on upgrade" vs "user-owned" content is cleaner when the boundary is at the directory level rather than between subdirectories. Having both `doc-templates/` (replaceable) and `docs/` (user-owned) inside the same parent directory was confusing.

**Implication:** When designing directory structures with mixed ownership, prefer separating concerns at the highest practical level. Users should be able to think "this whole directory is mine" or "this whole directory is framework."


