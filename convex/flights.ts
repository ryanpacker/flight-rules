import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Lifecycle mutations, called from the HTTP router (bearer-token checked
// there) at the moment of truth by consumer drivers and pipelines. Slugs may
// repeat across landed/scrubbed flights, so "the" flight for a slug is the
// open one: enroute (active work), holding (PR circling for review, env up),
// or diverted (parked at the alternate, env down). Teardown never decides a
// flight's fate -- it records a divert; landing clearance is declared with
// `hold`, and the PR observer in report.ingest closes holding flights.

const OPEN_STATUSES = ["enroute", "holding", "diverted"];

async function projectByName(ctx: MutationCtx | QueryCtx, name: string) {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!project) throw new Error(`Unknown project: ${name}`);
  return project;
}

async function flightsBySlug(
  ctx: MutationCtx | QueryCtx,
  projectId: Id<"projects">,
  slug: string,
) {
  return await ctx.db
    .query("flights")
    .withIndex("by_project_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .collect();
}

async function openBySlug(
  ctx: MutationCtx | QueryCtx,
  projectId: Id<"projects">,
  slug: string,
) {
  const rows = await flightsBySlug(ctx, projectId, slug);
  return rows.find((f) => OPEN_STATUSES.includes(f.status)) ?? null;
}

async function latestBySlug(
  ctx: MutationCtx | QueryCtx,
  projectId: Id<"projects">,
  slug: string,
) {
  const rows = await flightsBySlug(ctx, projectId, slug);
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
}

async function event(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  kind: string,
  payload: unknown,
  at: number,
) {
  await ctx.db.insert("events", { projectId, kind, payload, at });
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
    const existing = await openBySlug(ctx, project._id, flight.slug);
    const at = Date.now();
    if (existing?.status === "diverted") {
      // Un-park: a second takeoff on the same flight number.
      await ctx.db.patch(existing._id, {
        ...flight,
        status: "enroute",
        heldAt: undefined,
        fuelDeadline: undefined,
        divertedAt: undefined,
        divertReason: undefined,
      });
      await event(
        ctx,
        project._id,
        "takeoff",
        { slug: flight.slug, branch: flight.branch },
        at,
      );
      return existing._id;
    }
    if (existing) {
      // Idempotent: re-registering an open slug updates its env fields,
      // status untouched, no new event.
      await ctx.db.patch(existing._id, flight);
      return existing._id;
    }
    const id = await ctx.db.insert("flights", {
      projectId: project._id,
      status: "enroute",
      createdAt: at,
      ...flight,
    });
    await event(
      ctx,
      project._id,
      "takeoff",
      { slug: flight.slug, branch: flight.branch },
      at,
    );
    return id;
  },
});

const DEFAULT_FUEL_HOURS = 8;

export const hold = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
    prNumber: v.optional(v.number()),
    fuelHours: v.optional(v.number()),
  },
  handler: async (ctx, { projectName, slug, prNumber, fuelHours }) => {
    const project = await projectByName(ctx, projectName);
    const flight = await openBySlug(ctx, project._id, slug);
    if (!flight) throw new Error(`No open flight "${slug}" on ${projectName}`);
    if (flight.status === "diverted")
      throw new Error(
        `Flight "${slug}" is diverted -- takeoff to un-park it first`,
      );
    const at = Date.now();
    const hours = fuelHours ?? project.fuelHours ?? DEFAULT_FUEL_HOURS;
    const fields = {
      heldAt: at,
      fuelDeadline: at + hours * 60 * 60 * 1000,
      clearancePr: prNumber ?? flight.clearancePr ?? flight.report?.prNumber,
    };
    if (flight.status === "holding") {
      // Idempotent refresh: extends fuel, updates the clearance PR.
      await ctx.db.patch(flight._id, fields);
      return flight._id;
    }
    await ctx.db.patch(flight._id, { status: "holding", ...fields });
    await event(
      ctx,
      project._id,
      "hold",
      { slug, branch: flight.branch, number: fields.clearancePr },
      at,
    );
    return flight._id;
  },
});

export const resume = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { projectName, slug }) => {
    const project = await projectByName(ctx, projectName);
    const flight = await openBySlug(ctx, project._id, slug);
    if (!flight) throw new Error(`No open flight "${slug}" on ${projectName}`);
    if (flight.status === "enroute") return flight._id; // already there
    if (flight.status === "diverted")
      throw new Error(
        `Flight "${slug}" is diverted -- takeoff to un-park it, not resume`,
      );
    const at = Date.now();
    await ctx.db.patch(flight._id, {
      status: "enroute",
      heldAt: undefined,
      fuelDeadline: undefined,
    });
    await event(ctx, project._id, "resume", { slug, branch: flight.branch }, at);
    return flight._id;
  },
});

export const divert = internalMutation({
  args: {
    projectName: v.string(),
    slug: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { projectName, slug, reason }) => {
    const project = await projectByName(ctx, projectName);
    const flight = await openBySlug(ctx, project._id, slug);
    // Callers divert blind at teardown time (driver, reconciler). A flight
    // the observer already closed, one already diverted, or no flight at all
    // is success, not an error.
    if (!flight || flight.status === "diverted") return flight?._id ?? null;
    const at = Date.now();
    await ctx.db.patch(flight._id, {
      status: "diverted",
      heldAt: undefined,
      fuelDeadline: undefined,
      divertedAt: at,
      divertReason: reason,
    });
    await event(
      ctx,
      project._id,
      "divert",
      { slug, branch: flight.branch, reason },
      at,
    );
    return flight._id;
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
    const flight = await openBySlug(ctx, project._id, slug);
    if (!flight) {
      const latest = await latestBySlug(ctx, project._id, slug);
      if (latest?.status === "landed") return latest._id; // retry-safe
      throw new Error(`No open flight "${slug}" on ${projectName}`);
    }
    const at = Date.now();
    await ctx.db.patch(flight._id, { status: "landed", closedAt: at });
    await event(
      ctx,
      project._id,
      "landing",
      {
        slug,
        branch: flight.branch,
        number: prNumber ?? flight.clearancePr ?? flight.report?.prNumber,
      },
      at,
    );
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
    const flight = await openBySlug(ctx, project._id, slug);
    if (!flight) {
      const latest = await latestBySlug(ctx, project._id, slug);
      if (latest?.status === "scrubbed") return latest._id; // retry-safe
      throw new Error(`No open flight "${slug}" on ${projectName}`);
    }
    const at = Date.now();
    await ctx.db.patch(flight._id, { status: "scrubbed", closedAt: at });
    await event(
      ctx,
      project._id,
      "scrub",
      { slug, branch: flight.branch, reason },
      at,
    );
    return flight._id;
  },
});

// --- reconciler queries ------------------------------------------------------
// The consumer-side reconciler downs any live env whose flight is no longer
// enroute | holding (fuel expiry on a holding flight is one case). It acts
// only on rows it gets back: a transport error or null means skip.

function statusView(flight: Doc<"flights">) {
  return {
    slug: flight.slug,
    status: flight.status,
    branch: flight.branch,
    port: flight.port,
    worktreePath: flight.worktreePath,
    heldAt: flight.heldAt,
    fuelDeadline: flight.fuelDeadline,
    clearancePr: flight.clearancePr,
    divertedAt: flight.divertedAt,
    divertReason: flight.divertReason,
    createdAt: flight.createdAt,
    closedAt: flight.closedAt,
  };
}

export const holdingList = internalQuery({
  args: { projectName: v.string() },
  handler: async (ctx, { projectName }) => {
    const project = await projectByName(ctx, projectName);
    const rows = await ctx.db
      .query("flights")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    return rows
      .filter((f) => f.status === "holding")
      .map((f) => ({
        slug: f.slug,
        branch: f.branch,
        port: f.port,
        heldAt: f.heldAt,
        fuelDeadline: f.fuelDeadline,
        clearancePr: f.clearancePr,
      }));
  },
});

export const statusBySlug = internalQuery({
  args: { projectName: v.string(), slug: v.string() },
  handler: async (ctx, { projectName, slug }) => {
    const project = await projectByName(ctx, projectName);
    // Most recent row regardless of state; null strictly means "no flight
    // ever existed" -- the reconciler must not treat closed as absent.
    const latest = await latestBySlug(ctx, project._id, slug);
    return latest ? statusView(latest) : null;
  },
});
