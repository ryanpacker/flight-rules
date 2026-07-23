import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Stored states change only when real infrastructure changes. "airborne" is
// not a state: it means env-up (enroute | holding). "open" means on-the-board
// (enroute | holding | diverted). Richer labels are derived at render time.
export const flightStatus = v.union(
  v.literal("enroute"),
  v.literal("holding"),
  v.literal("diverted"),
  v.literal("landed"),
  v.literal("scrubbed"),
);

// A flight's report is a reported observation, not authority: reportedAt is
// mandatory and the UI must surface staleness.
export const flightReport = v.object({
  reportedAt: v.number(),
  listening: v.optional(v.boolean()),
  processes: v.record(v.string(), v.boolean()),
  dirtyCount: v.number(),
  ahead: v.number(),
  behind: v.number(),
  lastCommits: v.array(v.object({ sha: v.string(), subject: v.string() })),
  prNumber: v.optional(v.number()),
});

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    repoPath: v.string(),
    worktreeRoot: v.string(),
    githubRepo: v.string(), // "owner/name"
    integrationBranch: v.string(),
    prodUrl: v.optional(v.string()),
    // Default holding TTL in hours (fuel); the hold mutation falls back to 8.
    fuelHours: v.optional(v.number()),
    // Raw identifiers are stored on rows; URLs are derived from these
    // templates in the UI ({port} and {deployment} placeholders).
    templates: v.object({
      port: v.string(),
      deployment: v.string(),
    }),
  }).index("by_name", ["name"]),

  flights: defineTable({
    projectId: v.id("projects"),
    slug: v.string(),
    worktreePath: v.string(),
    branch: v.string(),
    port: v.optional(v.number()),
    deploymentName: v.optional(v.string()),
    status: flightStatus,
    createdAt: v.number(),
    closedAt: v.optional(v.number()),
    // Holding: the explicit declaration "this PR is my landing clearance".
    heldAt: v.optional(v.number()),
    fuelDeadline: v.optional(v.number()),
    clearancePr: v.optional(v.number()),
    // Diverted: parked at the alternate -- env down, branch kept, row stays.
    divertedAt: v.optional(v.number()),
    divertReason: v.optional(v.string()),
    report: v.optional(flightReport),
  })
    .index("by_project", ["projectId"])
    .index("by_project_slug", ["projectId", "slug"]),

  towers: defineTable({
    projectId: v.id("projects"),
    branch: v.string(),
    dirtyCount: v.number(),
    unpushedCount: v.number(),
    // Commits the checkout lags its upstream -- nonzero means work merged on
    // GitHub isn't in the tower's running environment yet.
    behindUpstream: v.optional(v.number()),
    // The tower's own dev environment, observed the same way a flight's is
    // (port/deployment from the checkout's env, liveness probed).
    port: v.optional(v.number()),
    deploymentName: v.optional(v.string()),
    listening: v.optional(v.boolean()),
    processes: v.optional(v.record(v.string(), v.boolean())),
    devVersion: v.optional(v.string()),
    prodVersion: v.optional(v.string()),
    reportedAt: v.number(),
  }).index("by_project", ["projectId"]),

  prs: defineTable({
    projectId: v.id("projects"),
    number: v.number(),
    title: v.string(),
    headRef: v.string(),
    state: v.string(),
    isDraft: v.boolean(),
    updatedAt: v.number(),
    // Real GitHub timestamps (optional: rows ingested before these were
    // reported lack them). createdAt drives the pr-opened event's `at`.
    createdAt: v.optional(v.number()),
    mergedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    // Review + CI state, synced so hold labels can be derived at render time
    // (never stored): reviewDecision is GitHub's enum, checksState is the
    // reporter's reduction of statusCheckRollup (passing|failing|pending).
    reviewDecision: v.optional(v.string()),
    checksState: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_number", ["projectId", "number"]),

  looseEnds: defineTable({
    projectId: v.id("projects"),
    text: v.string(),
    source: v.string(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  events: defineTable({
    projectId: v.id("projects"),
    kind: v.string(),
    payload: v.any(),
    at: v.number(),
  }).index("by_project_at", ["projectId", "at"]),
});
