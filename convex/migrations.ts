import { internalMutation } from "./_generated/server";

// One-off rename for the 2.2.0 lifecycle change: the active-work state
// "airborne" became "enroute" ("airborne" now means env-up: enroute or
// holding, so it can't name a single state). Run once via
//   npx convex run migrations:renameAirborneToEnroute
// while the schema still carries both literals, then drop "airborne" from
// flightStatus and redeploy. Safe to re-run (no-ops when nothing matches).
export const renameAirborneToEnroute = internalMutation({
  args: {},
  handler: async (ctx) => {
    const flights = await ctx.db.query("flights").collect();
    let renamed = 0;
    for (const flight of flights) {
      if ((flight.status as string) === "airborne") {
        await ctx.db.patch(flight._id, { status: "enroute" });
        renamed += 1;
      }
    }
    return { renamed };
  },
});
