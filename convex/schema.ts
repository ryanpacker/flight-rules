import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const flightStatus = v.union(
  v.literal("airborne"),
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
    report: v.optional(flightReport),
  })
    .index("by_project", ["projectId"])
    .index("by_project_slug", ["projectId", "slug"]),

  towers: defineTable({
    projectId: v.id("projects"),
    branch: v.string(),
    dirtyCount: v.number(),
    unpushedCount: v.number(),
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
