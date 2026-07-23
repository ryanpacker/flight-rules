import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { flightReport } from "./schema";

const flightSnapshot = v.object({
  slug: v.string(),
  worktreePath: v.string(),
  branch: v.string(),
  port: v.optional(v.number()),
  deploymentName: v.optional(v.string()),
  report: flightReport,
});

const prSnapshot = v.object({
  number: v.number(),
  title: v.string(),
  headRef: v.string(),
  state: v.string(),
  isDraft: v.boolean(),
  updatedAt: v.number(),
  createdAt: v.optional(v.number()),
  mergedAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  reviewDecision: v.optional(v.string()),
  checksState: v.optional(v.string()),
});

// Ingest one reporter snapshot. Flights the reporter no longer sees are left
// alone (their report just goes stale). The PR loop doubles as the observer:
// merges are always recorded as events, and a *holding* flight -- the only
// state that declared its PR as landing clearance -- is auto-landed on merge
// and auto-scrubbed on close-without-merge. Enroute flights are never
// auto-closed: multi-PR flights are first-class, a merge there is just news.
export const ingest = internalMutation({
  args: {
    projectName: v.string(),
    reportedAt: v.number(),
    tower: v.object({
      branch: v.string(),
      dirtyCount: v.number(),
      unpushedCount: v.number(),
      behindUpstream: v.optional(v.number()),
      port: v.optional(v.number()),
      deploymentName: v.optional(v.string()),
      listening: v.optional(v.boolean()),
      processes: v.optional(v.record(v.string(), v.boolean())),
      devVersion: v.optional(v.string()),
      prodVersion: v.optional(v.string()),
    }),
    flights: v.array(flightSnapshot),
    prs: v.array(prSnapshot),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_name", (q) => q.eq("name", args.projectName))
      .unique();
    if (!project) throw new Error(`Unknown project: ${args.projectName}`);
    const projectId = project._id;

    const tower = await ctx.db
      .query("towers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    const towerRow = { projectId, ...args.tower, reportedAt: args.reportedAt };
    if (tower) await ctx.db.replace(tower._id, towerRow);
    else await ctx.db.insert("towers", towerRow);

    for (const f of args.flights) {
      // Slugs repeat across closed flights; only the airborne row -- env up,
      // so enroute or holding -- (if any) belongs to this snapshot.
      const rows = await ctx.db
        .query("flights")
        .withIndex("by_project_slug", (q) =>
          q.eq("projectId", projectId).eq("slug", f.slug),
        )
        .collect();
      const existing = rows.find(
        (r) => r.status === "enroute" || r.status === "holding",
      );
      if (existing) {
        await ctx.db.patch(existing._id, {
          worktreePath: f.worktreePath,
          branch: f.branch,
          port: f.port,
          deploymentName: f.deploymentName,
          report: f.report,
        });
      } else {
        await ctx.db.insert("flights", {
          projectId,
          slug: f.slug,
          worktreePath: f.worktreePath,
          branch: f.branch,
          port: f.port,
          deploymentName: f.deploymentName,
          status: "enroute",
          createdAt: args.reportedAt,
          report: f.report,
        });
        await ctx.db.insert("events", {
          projectId,
          kind: "takeoff",
          payload: { slug: f.slug, branch: f.branch },
          at: args.reportedAt,
        });
      }
    }

    for (const pr of args.prs) {
      const existing = await ctx.db
        .query("prs")
        .withIndex("by_project_number", (q) =>
          q.eq("projectId", projectId).eq("number", pr.number),
        )
        .unique();
      const wasMerged = existing?.mergedAt !== undefined;
      if (existing) {
        await ctx.db.patch(existing._id, pr);
      } else {
        await ctx.db.insert("prs", { projectId, ...pr });
        // Stamp the event with the PR's real open time, so backfilled PRs
        // sort into their true place in the feed instead of piling up "now".
        await ctx.db.insert("events", {
          projectId,
          kind: "pr-opened",
          payload: { number: pr.number, title: pr.title, headRef: pr.headRef },
          at: pr.createdAt ?? args.reportedAt,
        });
      }
      if (pr.mergedAt !== undefined && !wasMerged) {
        await ctx.db.insert("events", {
          projectId,
          kind: "pr-merged",
          payload: { number: pr.number, title: pr.title, headRef: pr.headRef },
          at: pr.mergedAt,
        });
      }
    }

    // Observer: close holding flights from the PR state just synced. Driven
    // by current state, not transitions, so a missed snapshot can't strand a
    // flight in holding. Scoped to this project throughout -- PR numbers and
    // branch names collide across repos.
    const holding = (
      await ctx.db
        .query("flights")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    ).filter((f) => f.status === "holding");
    for (const flight of holding) {
      const clearanceNumber = flight.clearancePr ?? flight.report?.prNumber;
      const pr =
        clearanceNumber !== undefined
          ? args.prs.find((p) => p.number === clearanceNumber)
          : args.prs
              .filter((p) => p.headRef === flight.branch)
              .sort((a, b) => b.number - a.number)[0];
      if (!pr) continue;
      if (pr.mergedAt !== undefined) {
        const at = pr.mergedAt;
        await ctx.db.patch(flight._id, { status: "landed", closedAt: at });
        await ctx.db.insert("events", {
          projectId,
          kind: "landing",
          payload: { slug: flight.slug, branch: flight.branch, number: pr.number },
          at,
        });
      } else if (pr.state === "CLOSED") {
        const at = pr.closedAt ?? args.reportedAt;
        await ctx.db.patch(flight._id, { status: "scrubbed", closedAt: at });
        await ctx.db.insert("events", {
          projectId,
          kind: "scrub",
          payload: {
            slug: flight.slug,
            branch: flight.branch,
            reason: "PR closed unmerged",
          },
          at,
        });
      }
    }
  },
});
