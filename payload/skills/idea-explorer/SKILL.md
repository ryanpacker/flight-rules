---
name: idea-explorer
description: >
  Explore and refine early-stage ideas before they become formal requirements.
  Use this skill whenever someone has a raw idea, concept, or "what if" they want
  to think through — before it's ready for a PRD. Trigger when the user says things
  like "I have an idea", "what if we built...", "I'm thinking about...", "explore
  this concept", "help me think through...", "is this idea viable?", or "I want to
  build something that...". Also trigger when someone pastes a rough description,
  voice-to-text dump, or brainstorm notes and wants to make sense of them. This
  skill is the first step in turning a vague thought into something concrete enough
  to share with others or feed into a PRD.
compatibility:
  tools:
    - WebSearch
    - Agent
---

# Idea Explorer

Turn a raw, unstructured idea into a clear, well-examined **Idea Brief** — a
document that captures what the idea is, why it matters, what already exists in
the space, what customers would want to know, and how it might be built. The
brief is meant to be the bridge between "I had a thought" and "let's write a PRD."

## Why this exists

Ideas at their earliest stage are fragile and fuzzy. People know they want
*something* but can't always articulate it clearly. The gap between a raw idea
and a structured requirements document is where most good ideas die — not because
they're bad, but because no one helped the person think them through. This skill
fills that gap by deploying a team of specialized agents to examine the idea from
multiple angles simultaneously, then synthesizing everything into a document that
communicates the thought clearly.

## Prerequisites

This skill requires **web search** capability. The Market Scout and Technical
Scout agents need to search the internet to find existing products, services,
and technical approaches. If web search is not available, inform the user and
suggest they enable it before proceeding.

## Step 1: Receive the idea

The user's input could be anything — a single sentence, a rambling paragraph, a
pasted voice transcription, bullet points, a screenshot of notes. Accept whatever
format they give you. Don't ask them to restructure it.

Read the input carefully and identify:
- **The core intent** — What does this person actually want to exist in the world?
- **The problem space** — What pain or gap is motivating this?
- **Obvious gaps** — What critical information is missing that the agents will
  need to do their work?

## Step 2: Brief interview

Before launching the agents, ask a few focused questions to fill the most
critical gaps. Keep this short — 3-5 questions maximum. The agents will surface
deeper questions later. The goal here is just to give them enough context to be
effective.

Good interview questions target:
- **Who is this for?** (if not obvious from the input)
- **What exists today?** (how do people currently solve this problem, if at all?)
- **What's the motivation?** (personal itch, business opportunity, noticed gap?)
- **Any constraints?** (budget, timeline, technical environment, team size)
- **Scale and ambition** — Is this a weekend project, a startup, a feature within
  an existing product?

Don't ask all of these. Pick the ones that matter most given what the user
already told you. If the user's input was detailed enough, you might only need
1-2 clarifying questions, or even none.

Once you have the answers (or the user says "just go with what I gave you"),
compile a concise **Idea Context Brief** — a paragraph or two that summarizes
the idea and its context. This is what you'll hand to each agent.

## Step 3: Launch the agent team

Spawn all 7 agents in parallel. Each agent gets the Idea Context Brief plus
their specific mission. The agents are:

### 1. Intent Clarifier

**Mission:** Deeply understand what the user actually wants and surface the
questions that will sharpen the idea.

**Prompt pattern:**
```
You are the Intent Clarifier. Your job is to deeply analyze an idea and
identify what's clear, what's ambiguous, and what questions would most help
refine it.

Here is the idea:
[Idea Context Brief]

Analyze this idea and produce:

1. **Core Intent Statement** — In 1-2 sentences, what does this person
   actually want to exist? Strip away implementation details and get to the
   essence.

2. **What's Clear** — List the aspects of this idea that are well-defined
   and don't need further clarification.

3. **What's Ambiguous** — List the aspects that could be interpreted
   multiple ways. For each, explain the different interpretations.

4. **Clarifying Questions** — Generate 5-8 questions that would most help
   sharpen this idea. Prioritize questions that would change the direction
   of the project depending on the answer. Frame them as conversational
   questions the user could easily answer, not technical interrogations.

5. **Hidden Complexity** — Identify 2-3 aspects that seem simple on the
   surface but are likely more complex than the user realizes.
```

### 2. Problem Decomposer

**Mission:** Separate the problem from the proposed solution and break the
problem space into its components.

**Prompt pattern:**
```
You are the Problem Decomposer. Your job is to untangle the problem being
solved from the solution being proposed, and break the problem into its
constituent parts.

Here is the idea:
[Idea Context Brief]

Produce:

1. **Problem Statement** — What is the actual problem or pain point? State
   it without referencing any particular solution. A good problem statement
   makes someone nod and say "yes, that IS annoying / hard / broken."

2. **Current State** — How do people deal with this problem today? What
   workarounds exist? What are people settling for?

3. **Problem Components** — Break the problem into 3-5 sub-problems. For
   each, explain:
   - What it is
   - How painful it is (high/medium/low)
   - Whether existing solutions address it

4. **Solution vs. Problem Separation** — Is the user describing a problem
   or a solution? If they jumped straight to a solution, what's the
   underlying problem? Are there other solutions to that same problem they
   might not have considered?

5. **Who Feels This Pain** — List 2-4 different types of people or roles
   who experience this problem, and how their experience of it differs.
```

### 3. Assumptions Auditor

**Mission:** Surface the hidden assumptions baked into the idea and challenge
them.

**Prompt pattern:**
```
You are the Assumptions Auditor. Your job is to find the things the idea
takes for granted — the beliefs, conditions, and expectations that haven't
been stated or examined.

Here is the idea:
[Idea Context Brief]

Produce:

1. **Explicit Assumptions** — Things the idea openly relies on (e.g., "users
   have smartphones", "data is available via API").

2. **Hidden Assumptions** — Things the idea takes for granted without
   stating them. These are the dangerous ones. Common categories:
   - User behavior assumptions ("people will want to...")
   - Market assumptions ("there's demand for...")
   - Technical assumptions ("it's possible to...")
   - Economic assumptions ("people will pay for..." / "this can be built
     within budget")
   - Data assumptions ("this information exists and is accessible")

3. **Assumption Risk Assessment** — For each hidden assumption, rate:
   - How critical is it? (If wrong, does the whole idea fall apart?)
   - How confident should we be? (Is this well-established or a guess?)
   - How could we test it cheaply?

4. **The Hardest Question** — What's the single most uncomfortable question
   someone could ask about this idea? The one the user probably doesn't
   want to hear but needs to?
```

### 4. Market Scout

**Mission:** Search the internet for existing products, services, and projects
in the same space. This agent needs web search.

**Prompt pattern:**
```
You are the Market Scout. Your job is to research what already exists in the
market that's similar to or overlaps with this idea. Use web search
extensively.

Here is the idea:
[Idea Context Brief]

Research and produce:

1. **Direct Competitors** — Products or services that solve the same core
   problem. For each, note:
   - Name and URL
   - What they do
   - How they approach the problem
   - Pricing model (if known)
   - Apparent strengths and weaknesses

2. **Adjacent Solutions** — Products that solve a related problem or serve
   the same audience but with a different approach. These might become
   competitors or potential partners.

3. **Failed Attempts** — If you can find them, products or startups that
   tried something similar and failed. What went wrong? (This is
   incredibly valuable signal.)

4. **Market Gaps** — Based on your research, where are the existing
   solutions falling short? What do users complain about? What's missing?

5. **Landscape Summary** — In 2-3 sentences, characterize the competitive
   landscape. Is it crowded? Emerging? Dominated by one player? Wide open?

Search broadly — try different phrasings of the problem, look at Product
Hunt, search for Reddit discussions, check GitHub for open-source
alternatives. Cast a wide net.
```

### 5. Customer Voice

**Mission:** Role-play as potential customers and surface the questions and
concerns real users would have.

**Prompt pattern:**
```
You are the Customer Voice. Your job is to think like 3-4 different
potential customers and anticipate their reactions, questions, and concerns
about this idea.

Here is the idea:
[Idea Context Brief]

Create 3-4 distinct customer personas, each representing a different
segment that might use this. For each persona:

1. **Who they are** — Name, role, context. Make them feel like real people,
   not marketing abstractions.

2. **Their reaction** — How would they respond when first hearing about
   this idea? Excited? Skeptical? Confused? Indifferent?

3. **Their questions** — What would they immediately want to know? List
   5-7 questions in their natural voice. Include both practical questions
   ("Does this work with X?") and emotional ones ("Can I trust this with
   my data?").

4. **Their dealbreakers** — What would make them say "no thanks"?

5. **Their "shut up and take my money" moment** — What would make them
   immediately want this?

Make the personas genuinely different — don't just vary demographics. Vary
their relationship to the problem, their technical sophistication, their
willingness to pay, and their current workarounds.
```

### 6. Technical Scout

**Mission:** Research the technical landscape — what technologies, APIs,
frameworks, and approaches could make this idea real. This agent needs web
search.

**Prompt pattern:**
```
You are the Technical Scout. Your job is to research how this idea could
be built from a technical perspective. Use web search to find relevant
technologies, APIs, and approaches.

Here is the idea:
[Idea Context Brief]

Research and produce:

1. **Technical Approaches** — 2-3 different ways this could be built.
   For each, describe:
   - The core architecture
   - Key technologies/frameworks/services involved
   - Rough complexity level (weekend project → multi-team effort)
   - Major trade-offs

2. **Key Technologies** — Specific APIs, services, libraries, or platforms
   that would be central to building this. For each, note:
   - What it does
   - Maturity level (production-ready, beta, experimental)
   - Cost implications
   - Alternatives

3. **Technical Risks** — What are the hardest technical challenges? What
   might not work as expected? Where are the unknowns?

4. **Build vs. Buy** — Are there components that should be built custom
   vs. using existing services? Where would you spend engineering time
   vs. money?

5. **Feasibility Assessment** — Overall, how technically feasible is this?
   Rate as: Straightforward / Moderate / Challenging / Research-required.
   Explain your rating.

Search for relevant documentation, GitHub repos, technical blog posts,
and Stack Overflow discussions. Look for people who've built similar things
and what they learned.
```

### 7. Elevator Pitch Crafter

**Mission:** Distill everything into a clear, compelling description. This
agent runs *after* the other 6 complete — it needs their outputs as input.

**Important:** Do NOT spawn this agent with the others. Wait for agents 1-6
to finish, then launch this agent with their combined outputs.

**Prompt pattern:**
```
You are the Elevator Pitch Crafter. Your job is to take the outputs from
six research agents and distill them into a clear, compelling description
of this idea.

Here is the original idea:
[Idea Context Brief]

Here are the outputs from the research team:
[Intent Clarifier output]
[Problem Decomposer output]
[Assumptions Auditor output]
[Market Scout output]
[Customer Voice output]
[Technical Scout output]

Produce:

1. **Elevator Pitch** — 2-3 sentences that clearly communicate what this
   idea is, who it's for, and why it matters. This should be immediately
   understandable by anyone — no jargon, no hand-waving. If you can't
   write a clear pitch, explain what's still too fuzzy and what questions
   need to be answered first.

2. **One-Paragraph Description** — Expand the pitch into a paragraph that
   adds enough detail for someone to evaluate whether they're interested
   in learning more.

3. **Key Differentiator** — Based on the market research, what would make
   this idea stand out? What's the "why this, why now" argument?

4. **Remaining Questions** — What are the 3-5 most important questions
   that still need answers before this idea is ready for a formal PRD?
   Prioritize them.

5. **Readiness Assessment** — Is this idea ready to move to PRD stage?
   Rate as: Ready / Almost (needs X) / Needs More Work (because Y).
```

## Step 4: Synthesize the Idea Brief

Once all agents have reported back, compile their outputs into a single
markdown document. The brief should be structured to tell a clear story,
not just dump agent outputs.

### Idea Brief structure

```markdown
# Idea Brief: [Idea Name]

> [Elevator pitch — 2-3 sentences from the Pitch Crafter]

## Overview

[One-paragraph description from the Pitch Crafter]

## The Problem

[Problem statement from Problem Decomposer]

### How people deal with this today
[Current state from Problem Decomposer]

### Who feels this pain
[From Problem Decomposer — the different types of people affected]

## Market Landscape

[Landscape summary from Market Scout]

### Existing solutions
[Direct competitors and adjacent solutions from Market Scout]

### Market gaps
[Gaps identified by Market Scout]

### Failed attempts
[If any were found — valuable cautionary context]

## Customer Perspective

[For each persona from Customer Voice:]
### [Persona Name] — [Role/Context]
- **Reaction:** [Their likely reaction]
- **Key questions:** [Their top questions]
- **Dealbreakers:** [What would turn them away]
- **Hook:** [What would make them want this immediately]

## Technical Feasibility

[Feasibility assessment from Technical Scout]

### Possible approaches
[Technical approaches with trade-offs]

### Key technologies
[Relevant APIs, services, frameworks]

### Technical risks
[What's hard, what's unknown]

## Assumptions to Test

[From Assumptions Auditor — the critical hidden assumptions]

### Highest-risk assumptions
[The ones that could sink the whole idea]

### How to test them
[Cheap validation approaches]

## Open Questions

[Combined from Intent Clarifier, Assumptions Auditor, and Pitch Crafter.
Deduplicate and prioritize. These are the questions that need answers
before moving to a PRD.]

## Key Differentiator

[From Pitch Crafter — why this, why now]

## Readiness Assessment

[From Pitch Crafter — is this ready for PRD stage?]

---
*Generated by idea-explorer on [date]*
```

### Writing the brief

When assembling the brief:
- Don't just paste agent outputs verbatim. Synthesize, deduplicate, and
  create a coherent narrative.
- Use the agents' outputs as raw material, but write the brief in a
  consistent voice.
- If agents contradicted each other (e.g., Market Scout found competitors
  but Assumptions Auditor assumed there were none), flag the contradiction
  explicitly — that's valuable signal.
- Keep the tone conversational and honest. This isn't a pitch deck trying
  to sell someone — it's a thinking document trying to understand something.

## Step 5: Present and iterate

After generating the brief:

1. Save it to `docs/idea-brief.md`
2. Present a summary to the user highlighting:
   - The elevator pitch
   - The most surprising findings (competitors they didn't know about,
     assumptions they hadn't considered, technical challenges)
   - The top 3-5 open questions
   - The readiness assessment
3. Ask if they want to:
   - **Dig deeper** on any section (re-run specific agents with updated
     context)
   - **Answer open questions** (update the brief with new information and
     re-run relevant agents)
   - **Move to PRD** (if the readiness assessment says it's ready, suggest
     using `/prd.create` with the brief as input)
   - **Shelve it** (save the brief for later consideration)

## Tips for the interview

- Match the user's energy. If they're excited, be encouraging. If they're
  uncertain, be supportive. Don't be falsely enthusiastic about every idea,
  but don't be a wet blanket either.
- If the idea sounds like something that clearly already exists, don't say
  "that already exists" — let the Market Scout find it. There might be a
  nuance you're missing, or the user might be aware and planning to
  differentiate.
- If the user gives you very little to work with ("I want to build an app"),
  ask more questions in the interview. If they give you a detailed dump,
  ask fewer. Scale the interview to the gap.
- Some users think in problems ("I hate how X works"), some think in
  solutions ("I want to build Y"). Both are valid starting points. The
  Problem Decomposer will sort out which is which.
