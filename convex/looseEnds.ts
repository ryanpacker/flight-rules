import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertSecret } from "./lib/secret";

export const add = mutation({
  args: {
    secret: v.string(),
    projectName: v.string(),
    text: v.string(),
    source: v.string(),
  },
  handler: async (ctx, { secret, projectName, text, source }) => {
    assertSecret(secret);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_name", (q) => q.eq("name", projectName))
      .unique();
    if (!project) throw new Error(`Unknown project: ${projectName}`);
    return await ctx.db.insert("looseEnds", {
      projectId: project._id,
      text,
      source,
      createdAt: Date.now(),
    });
  },
});

export const resolve = mutation({
  args: { secret: v.string(), id: v.id("looseEnds") },
  handler: async (ctx, { secret, id }) => {
    assertSecret(secret);
    await ctx.db.patch(id, { resolvedAt: Date.now() });
  },
});
