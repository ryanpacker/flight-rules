---
name: skill-improve
description: >
  Research-driven skill improvement. Analyzes an existing skill for weaknesses, then
  searches the internet extensively for popular similar skills, prompts, and techniques
  from the community (GitHub repos, awesome-lists, prompt engineering resources, official
  Anthropic docs) to find ideas worth incorporating. Produces a prioritized improvement
  report and implements approved changes. Use this skill whenever the user says things like
  "improve this skill", "make this skill better", "enhance skill", "optimize skill",
  "research better approaches for this skill", "find ways to improve this skill",
  "what are other people doing for skills like this", "benchmark this skill against others",
  or "level up this skill". Also trigger when the user wants to compare their skill against
  community alternatives or find inspiration from popular skills in the ecosystem.
---

# Skill Improver

Improve an existing skill by combining internal analysis with extensive internet research.
The goal is to find concrete, actionable improvements — not generic advice — by studying
what the best similar skills in the ecosystem actually do.

## How it works

1. **Understand the skill** — Read it deeply, understand its purpose and mechanics
2. **Analyze internally** — Find structural and content issues
3. **Research externally** — Search the internet for similar popular skills and techniques
4. **Compare and synthesize** — Extract the best ideas from what you found
5. **Report** — Present prioritized recommendations to the user
6. **Implement** — Apply the approved improvements

## Step 1: Understand the target skill

Ask the user which skill to improve if not already specified. Then read the skill file
thoroughly. Before doing anything else, write a brief summary of:

- What the skill does
- How it's structured (sections, flow, resources)
- What triggers it (the description field)
- What tools/techniques it uses
- Any bundled resources (scripts, references, assets)

Share this summary with the user to confirm you understand the skill correctly. Misunderstanding
the skill's purpose will lead to bad recommendations.

## Step 2: Internal analysis

Examine the skill against these quality dimensions. Be specific — cite line numbers or
quote passages when noting issues.

### Structure and clarity
- Is the flow logical? Would someone following it step-by-step get good results?
- Are instructions clear enough that a model can follow them without guessing?
- Is there unnecessary repetition or bloat that could be cut?
- Are there gaps where the model would need to improvise?

### Description quality
- Does the description cover the right trigger phrases?
- Is it specific enough to avoid false triggers?
- Is it "pushy" enough to trigger when it should? (Skills tend to under-trigger)

### Instruction effectiveness
- Are there heavy-handed MUST/NEVER/ALWAYS directives that could be replaced with
  explanations of *why* something matters?
- Are examples included where they'd help?
- Is the skill explaining the reasoning behind its instructions, or just giving orders?

### Progressive disclosure
- Is the SKILL.md under 500 lines? If longer, should content move to reference files?
- Are bundled resources referenced clearly with guidance on when to read them?

### Robustness
- Does it handle edge cases the user might encounter?
- Are there implicit assumptions that could fail in different contexts?

Produce a concise internal analysis report organized by dimension.

## Step 3: External research

This is the core differentiator of this skill. Search the internet extensively to find
popular, well-regarded skills and techniques that address similar problems. The goal is
to discover ideas, patterns, and approaches the current skill is missing.

### Where to search

Run multiple searches across these categories. Use subagents for parallel research when
available — this step benefits enormously from breadth.

**Similar skills in the ecosystem:**
- Search GitHub for skills with similar names or purposes
  (e.g., `claude skill [topic]`, `awesome claude skills [topic]`)
- Check curated lists: `awesome-claude-skills`, `awesome-claude-code-toolkit`
- Look for skills on the Claude Skills directory if available
- Search for Cursor rules, Windsurf rules, or other AI coding tool configurations
  that address the same domain

**Prompt engineering techniques:**
- Search for prompt engineering patterns relevant to the skill's domain
- Look for academic or blog posts on techniques like chain-of-thought, few-shot
  examples, self-correction, or structured output formats
- Check the Anthropic documentation for relevant best practices

**Domain-specific best practices:**
- If the skill targets a specific domain (e.g., testing, code review, documentation),
  search for industry best practices in that domain
- Look for popular tools, linters, or frameworks that encode domain expertise

**Community discussions:**
- Search for discussions about similar workflows on GitHub issues, forums, or blogs
- Look for "how I use Claude for X" posts that might reveal techniques

### What to extract from each source

For each relevant source you find, note:

- **Source**: URL and brief description
- **Key technique or pattern**: What does it do that's interesting?
- **Relevance**: How does this relate to the skill being improved?
- **Adoption signal**: Stars, installs, mentions — is this actually popular/proven?
- **Adaptability**: How easily could this be incorporated into the current skill?

### Research depth

Aim for at least 5-8 distinct sources across the categories above. Quality matters more
than quantity — a single well-designed skill that solves the same problem is worth more
than ten tangentially related blog posts.

If the skill's domain is niche and you can't find direct comparables, broaden the search
to adjacent domains or look for transferable patterns from popular skills in other domains.

## Step 4: Compare and synthesize

Now bring together your internal analysis and external research. For each finding from
the research, ask:

- Does the current skill already do this? If so, does it do it as well?
- Would incorporating this idea make the skill meaningfully better?
- Is this idea compatible with the skill's existing approach, or would it require
  a significant restructure?
- Is this a proven pattern (used in multiple popular skills) or a one-off experiment?

Organize your findings into a synthesis that highlights the gaps between the current
skill and the best practices you found.

## Step 5: Present the improvement report

Present a structured report to the user with three sections:

### High-priority improvements
Changes that would significantly improve the skill's effectiveness. These are things
where popular, proven alternatives exist and the current skill is clearly weaker.

### Medium-priority improvements
Useful enhancements that would make the skill more robust or cover more cases, but
the current approach isn't broken.

### Low-priority / exploratory ideas
Interesting techniques spotted in the research that might be worth trying but aren't
clearly better than the current approach. Include these so the user can decide.

For each recommendation:
- **What to change**: Specific, actionable description
- **Why**: What problem it solves or what improvement it brings
- **Source**: Where you found this idea (with link if from external research)
- **Effort**: How much work it would take (small tweak vs. significant rewrite)

After presenting the report, ask the user which improvements they'd like to implement.

## Step 6: Implement approved improvements

Apply the changes the user approved. When implementing:

- Make changes incrementally — don't rewrite the entire skill at once
- Preserve the skill's voice and style unless the user wants a different tone
- If a change requires restructuring, explain the new structure before doing it
- After implementing, show a summary of what changed

If the user wants to test the improvements, suggest using the skill-creator's evaluation
workflow to compare before and after.

## Tips for effective research

**Cast a wide net, then narrow.** Start with broad searches, scan the results for the
most relevant hits, then dig deep into those. A search for "claude skill code review"
might surface a skill that has nothing to do with code review but uses a brilliant
self-correction pattern you can steal.

**Look at structure, not just content.** Sometimes the most valuable thing about a
popular skill isn't what it says but how it's organized — how it uses progressive
disclosure, how it sequences instructions, how it handles edge cases.

**Pay attention to what's missing.** If every popular skill in a domain does X and the
target skill doesn't, that's a strong signal. If no popular skill does Y and the target
skill does, ask whether Y is genuinely innovative or just unnecessary.

**Check the stars and installs.** A skill with 100K+ installs that does something
differently is stronger evidence than a blog post with 3 likes. Popularity isn't
everything, but it's a useful signal for proven approaches.

## Notes

- This skill works best when you have web search capabilities. Without them, the
  external research step is limited to what's already in your training data.
- For skills that are part of a larger system (like flight-rules commands), consider
  how improvements might affect integration with other components.
- If the skill-creator skill is available, consider using its evaluation workflow
  after implementing improvements to measure the impact quantitatively.
