import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Lifecycle mutations, called from the HTTP router (bearer-token checked
// there) at the moment of truth by consumer projects' takeoff/land/scrub
// hooks. Slugs may repeat across landed/scrubbed flights, so "the" flight
// for a slug is always the airborne one.

async function projectByName(ctx: MutationCtx, name: string) {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!project) throw new Error(`Unknown project: ${name}`);
  return project;
}

async function airborneBySlug(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  slug: string,
) {
  const rows = await ctx.db
    .query("flights")
    .withIndex("by_project_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .collect();
  return rows.find((f) => f.status === "airborne") ?? null;
}

export const takeoff = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
    branch: v.string(),
    worktreePath: v.string(),
    port: v.optional(v.number()),
    deploymentName: v.optional(v.string()),
  },
  handler: async (ctx, { projectName, ...flight }) => {
    const project = await projectByName(ctx, projectName);
    // Idempotent: re-registering an airborne slug updates it, no new event.
    const existing = await airborneBySlug(ctx, project._id, flight.slug);
    if (existing) {
      await ctx.db.patch(existing._id, flight);
      return existing._id;
    }
    const at = Date.now();
    const id = await ctx.db.insert("flights", {
      projectId: project._id,
      status: "airborne",
      createdAt: at,
      ...flight,
    });
    await ctx.db.insert("events", {
      projectId: project._id,
      kind: "takeoff",
      payload: { slug: flight.slug, branch: flight.branch },
      at,
    });
    return id;
  },
});

export const land = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
    prNumber: v.optional(v.number()),
  },
  handler: async (ctx, { projectName, slug, prNumber }) => {
    const project = await projectByName(ctx, projectName);
    const flight = await airborneBySlug(ctx, project._id, slug);
    if (!flight)
      throw new Error(`No airborne flight "${slug}" on ${projectName}`);
    const at = Date.now();
    await ctx.db.patch(flight._id, { status: "landed", closedAt: at });
    await ctx.db.insert("events", {
      projectId: project._id,
      kind: "landing",
      payload: {
        slug,
        branch: flight.branch,
        number: prNumber ?? flight.report?.prNumber,
      },
      at,
    });
    return flight._id;
  },
});

export const scrub = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { projectName, slug, reason }) => {
    const project = await projectByName(ctx, projectName);
    const flight = await airborneBySlug(ctx, project._id, slug);
    if (!flight)
      throw new Error(`No airborne flight "${slug}" on ${projectName}`);
    const at = Date.now();
    await ctx.db.patch(flight._id, { status: "scrubbed", closedAt: at });
    await ctx.db.insert("events", {
      projectId: project._id,
      kind: "scrub",
      payload: { slug, branch: flight.branch, reason },
      at,
    });
    return flight._id;
  },
});
