---
name: flight-rules-planning-docs
description: Use when the user wants to run a Flight Rules planning or documentation workflow such as prd.create, prd.clarify, impl.outline, impl.create, impl.clarify, feature.add, test.add, test.assess-current, readme.create, readme.reconcile, prd.reconcile, impl.reconcile, docs.reconcile, impl.validate, prompt.refine, backlog.add, backlog.clarify, backlog.list, backlog.promote, or version.bump.
metadata:
  short-description: Run Flight Rules planning and docs workflows
---

# Flight Rules Planning And Docs

Use this skill for Flight Rules workflows that create, refine, validate, or reconcile documentation and planning artifacts.

## Workflow

1. Match the user's request to the corresponding file in `.flight-rules/commands/`.
2. Read only the command file and supporting project docs needed for that workflow.
3. Treat `.flight-rules/commands/` as the source of truth.
4. Update the relevant files in `docs/` so the implementation docs remain aligned with reality.

## Common Command Files

- `.flight-rules/commands/prd.create.md`
- `.flight-rules/commands/prd.clarify.md`
- `.flight-rules/commands/impl.outline.md`
- `.flight-rules/commands/impl.create.md`
- `.flight-rules/commands/impl.clarify.md`
- `.flight-rules/commands/feature.add.md`
- `.flight-rules/commands/test.add.md`
- `.flight-rules/commands/test.assess-current.md`
- `.flight-rules/commands/readme.create.md`
- `.flight-rules/commands/readme.reconcile.md`
- `.flight-rules/commands/prd.reconcile.md`
- `.flight-rules/commands/impl.reconcile.md`
- `.flight-rules/commands/docs.reconcile.md`
- `.flight-rules/commands/impl.validate.md`
- `.flight-rules/commands/prompt.refine.md`
- `.flight-rules/commands/backlog.add.md`
- `.flight-rules/commands/backlog.clarify.md`
- `.flight-rules/commands/backlog.list.md`
- `.flight-rules/commands/backlog.promote.md`
- `.flight-rules/commands/version.bump.md`

