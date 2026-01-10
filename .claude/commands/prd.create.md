# Create PRD

When the user invokes this command, help them create a Product Requirements Document (PRD). This command supports two modes: conversational (default) and one-shot (when the user provides a description).

## 1. Check for Existing PRD

Read `docs/prd.md` if it exists. If it contains substantive content (not just the template):

> "I found an existing PRD at `docs/prd.md`. Would you like me to:"
> 1. **Replace it** — Start fresh with a new PRD
> 2. **Refine it** — Use `/prd.clarify` to improve specific sections
>
> Which would you prefer?

Wait for the user's response before proceeding.

## 2. Assess Scope

Before proceeding, assess the complexity of what's being built:

- **Small** (single feature, clear outcome, limited ambiguity) → PRD should be ~1 page or less. Sections should be combined or abbreviated where they would be redundant.
- **Medium** (multiple features, some ambiguity, multiple user types) → Standard PRD treatment with all sections.
- **Large** (system-level changes, many stakeholders, significant technical complexity) → Full detail in all sections, potentially with sub-documents.

For **small** projects, explicitly tell the user:

> "This seems straightforward enough that we don't need a heavyweight PRD. I'll keep this concise and combine sections where they'd be redundant."

For **small** projects, the entire PRD might be:

- **Overview:** 2-3 sentences
- **Goals/Success Criteria (combined):** 1-3 bullet points
- **Non-Goals:** 1-2 items, or "None significant for this scope"
- **User Stories:** 1-2 stories
- **Constraints:** Only if genuinely relevant; omit if none

Do not pad sections to appear thorough. A thin section that accurately reflects a simple scope is better than a bloated section that manufactures complexity.

## 3. Determine Mode

**One-shot mode:** If the user provided a description with the command (e.g., "create a PRD for a photo organization app"), proceed to Step 4.

**Conversational mode:** If the user invoked the command without a description, proceed to Step 5.

## 4. One-Shot Mode

Generate an initial PRD draft based on the user's description:

1. **Parse the description** for key information about:
   - What the product/feature is
   - Who it's for
   - What problem it solves

2. **Apply scope assessment** from Step 2. Match document weight to project complexity.

3. **Generate a draft PRD** following the template structure from `.flight-rules/doc-templates/prd.md`:
   - **Overview** — Synthesize the core concept
   - **Goals** — Infer 3-5 measurable goals (fewer for small projects)
   - **Non-Goals** — Infer reasonable boundaries (may be minimal for focused features)
   - **User Stories** — Generate stories in "As a [user], I want [goal] so that [benefit]" format
   - **Constraints** — Note any mentioned limitations (omit if none are relevant)
   - **Success Criteria** — Propose measurable outcomes (may be combined with Goals for small projects)

   For small projects: If Goals and Success Criteria would say essentially the same thing, combine them into a single "Goals & Success Criteria" section. If Constraints are not meaningfully present, omit the section rather than inventing limitations.

4. **Present the draft** with highlighted gaps:

> **Draft PRD Generated**
>
> I've created an initial PRD based on your description. Here it is:
>
> [Show the complete draft]
>
> **Areas that may need more detail:**
> - [List sections that seem thin or assumed — but only if the thinness represents a genuine gap, not just a simple scope]
>
> Would you like me to:
> 1. Save this draft and refine specific sections
> 2. Walk through each section conversationally to fill in gaps
> 3. Save as-is

5. Based on the user's choice:
   - **Option 1:** Save to `docs/prd.md` and offer to run `/prd.clarify`
   - **Option 2:** Switch to conversational mode (Step 5), using the draft as a starting point
   - **Option 3:** Save to `docs/prd.md` and report completion

## 5. Conversational Mode

Adopt the persona of a senior product manager who has shipped multiple successful products. You're known for asking "why" until you truly understand the problem, and for pushing back when requirements are vague or unmeasurable. You're also known for keeping documents proportional to the actual complexity—you don't write 10-page PRDs for 2-day features.

### 5.1 Introduction

Adjust your introduction based on the scope assessment:

**For medium/large projects:**

> "I'm going to help you create a Product Requirements Document. I'll walk you through 6 sections, asking questions and pushing back when things are unclear. At the end, we'll have a complete PRD.
>
> Let's start with the **Overview**. What is this project, and why does it exist?"

**For small projects:**

> "This sounds like a focused feature, so I'll keep the PRD lean. I'll ask you a few key questions and we'll end up with a concise document—probably under a page.
>
> Let's start: What is this feature, and what problem does it solve?"

### 5.2 Interview Through Each Section

Walk through each section, but **adapt depth to scope**. For small projects, combine sections and move quickly. For larger projects, dig deeper.

**Section 1: Overview**
- Ask: What is this project? Why does it exist?
- Push for clarity on the core problem being solved
- Summarize before moving on

**Section 2: Goals**
- Ask: What are you trying to achieve? (aim for 3-5 goals; 1-2 for small projects)
- Challenge platitudes ("improve user experience" → "reduce time to complete X by Y%")
- Ask "how will you measure that?" for each goal
- For small projects: If the goal is obvious from the overview, acknowledge it and move on rather than belaboring
- Summarize before moving on

**Section 3: Non-Goals**
- Ask: What is explicitly out of scope?
- For medium/large projects: Don't let them skip this—people always forget and regret it
- For small projects: A sentence or two is fine; if the scope is already tight, acknowledge that ("Given how focused this is, non-goals may not be necessary—anything you want to explicitly exclude?")
- Suggest non-goals based on what you've heard (e.g., "It sounds like mobile support might be a non-goal for v1?")
- Summarize before moving on

**Section 4: User Stories**
- Ask: Who benefits from this, and how?
- Guide toward the format: "As a [type of user], I want [goal] so that [benefit]"
- Push for multiple user types if appropriate (but for small features, 1-2 stories may be sufficient)
- Summarize before moving on

**Section 5: Constraints**
- Ask: What limitations affect this project?
- Prompt with categories: timeline, budget, technology, dependencies, team capacity
- For small projects: If there are no meaningful constraints, it's okay to skip or note "No significant constraints identified"
- Summarize before moving on

**Section 6: Success Criteria**
- Ask: How will you know this project succeeded?
- Insist on specific, measurable, observable outcomes
- Connect back to Goals—every goal should have a way to measure success
- For small projects: If success criteria are identical to goals, combine them: "It sounds like the goals are the success criteria here—ship the feature, users can do X. Does that capture it?"
- Summarize before moving on

### 5.3 Review and Validate

Before generating the final PRD:

1. **Check consistency:**
   - Do goals and non-goals conflict?
   - Are success criteria aligned with goals?
   - Are user stories coherent with the overview?

2. **Check proportionality:**
   - Is the document appropriately sized for the scope?
   - Are there sections that are redundant or padded?

3. **Flag issues** (only if genuine issues exist):

> **Before I generate the PRD, I noticed:**
> - [List any inconsistencies or gaps]
>
> Would you like to address these, or proceed as-is?

If no issues exist, skip this and proceed to generation.

4. **Generate the complete PRD** following the template structure, combining or abbreviating sections as appropriate for the scope.

## 6. Save and Report

Save the PRD to `docs/prd.md` and confirm:

> **PRD Created:** `docs/prd.md`
>
> **Summary:**
> - Overview: [one-line summary]
> - Goals: [count] goals defined
> - Non-Goals: [count] non-goals defined (or "Combined/omitted for scope")
> - User Stories: [count] user stories
> - Constraints: [count] constraints noted (or "None significant")
> - Success Criteria: [count] measurable criteria (or "Combined with Goals")
>
> You can refine specific sections later with `/prd.clarify`.

## Key Behaviors

Throughout this command, maintain these behaviors:

- **Right-size the document** — A PRD for "add dark mode toggle" should not be the same length as "rebuild authentication system." When sections would say the same thing (e.g., Goals and Success Criteria both amount to "users can toggle dark mode"), combine them or note the redundancy explicitly rather than padding. Match document weight to actual complexity.

- **Push back on vagueness** — Don't accept first answers that are unclear

- **Ask "why" repeatedly** — Until the real problem is understood

- **Demand measurability** — Goals and success criteria must be specific

- **Respect non-goals** — These prevent scope creep, but don't manufacture them for simple features

- **Check consistency** — Goals, non-goals, and success criteria should align

- **Help, don't block** — If user says "I don't know," help them figure it out

- **Prefer concision** — A complete thought in one sentence beats a padded paragraph. Omit sections that add no value for a given scope rather than filling them with placeholder content.
