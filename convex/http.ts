import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

import type { FunctionReference } from "convex/server";

const http = httpRouter();

function authorized(request: Request): boolean {
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const expected = process.env.FLIGHT_RULES_SECRET;
  return Boolean(expected) && token === expected;
}

// POST route boilerplate: bearer check, JSON body, run one internal mutation.
function mutationRoute(
  path: string,
  fn: FunctionReference<"mutation", "internal">,
) {
  http.route({
    path,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      if (!authorized(request))
        return new Response("Unauthorized", { status: 401 });
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      try {
        const result = await ctx.runMutation(fn, body as never);
        return Response.json({ ok: true, result });
      } catch (err) {
        return new Response(
          err instanceof Error ? err.message : "Bad request",
          { status: 400 },
        );
      }
    }),
  });
}

// Reporter posts a full snapshot here.
mutationRoute("/report", internal.report.ingest);

// Seed / update a project row.
mutationRoute("/projects", internal.projects.upsert);

// Lifecycle hooks post here at the moment of truth (takeoff/land/scrub
// scripts in consumer projects).
mutationRoute("/flights/takeoff", internal.flights.takeoff);
mutationRoute("/flights/land", internal.flights.land);
mutationRoute("/flights/scrub", internal.flights.scrub);

// Reporter fetches its project config from here -- config lives in the
// registry, never in the public repo.
http.route({
  path: "/projects",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request))
      return new Response("Unauthorized", { status: 401 });
    const name = new URL(request.url).searchParams.get("name");
    if (!name) return new Response("Missing ?name=", { status: 400 });
    const project = await ctx.runQuery(internal.projects.getByName, { name });
    if (!project) return new Response("Unknown project", { status: 404 });
    return Response.json(project);
  }),
});

export default http;
