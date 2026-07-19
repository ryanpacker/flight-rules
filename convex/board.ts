import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertSecret } from "./lib/secret";

// Everything the board renders, in one reactive query.
export const get = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    assertSecret(secret);
    const projects = await ctx.db.query("projects").collect();
    return await Promise.all(
      projects.map(async (project) => {
        const [flights, tower, prs, looseEnds, events] = await Promise.all([
          ctx.db
            .query("flights")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
          ctx.db
            .query("towers")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .unique(),
          ctx.db
            .query("prs")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
          ctx.db
            .query("looseEnds")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
          ctx.db
            .query("events")
            .withIndex("by_project_at", (q) => q.eq("projectId", project._id))
            .order("desc")
            .take(50),
        ]);
        return {
          project,
          tower,
          flights,
          prs,
          looseEnds: looseEnds.filter((l) => !l.resolvedAt),
          events,
        };
      }),
    );
  },
});
