import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Projects are managed via the HTTP actions (bearer-token checked there), so
// these are internal-only.

const projectFields = {
  name: v.string(),
  repoPath: v.string(),
  worktreeRoot: v.string(),
  githubRepo: v.string(),
  integrationBranch: v.string(),
  prodUrl: v.optional(v.string()),
  templates: v.object({
    port: v.string(),
    deployment: v.string(),
  }),
};

export const upsert = internalMutation({
  args: projectFields,
  handler: async (ctx, fields) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_name", (q) => q.eq("name", fields.name))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("projects", fields);
  },
});

export const getByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
  },
});
