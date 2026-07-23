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

// Lifecycle verbs post here at the moment of truth (the driver and consumer
// pipelines, via flight.mjs). Contract: docs/lifecycle-contract.md.
mutationRoute("/flights/takeoff", internal.flights.takeoff);
mutationRoute("/flights/hold", internal.flights.hold);
mutationRoute("/flights/resume", internal.flights.resume);
mutationRoute("/flights/divert", internal.flights.divert);
mutationRoute("/flights/land", internal.flights.land);
mutationRoute("/flights/scrub", internal.flights.scrub);

// Reconciler queries: the consumer-side loop downs any live env whose flight
// is no longer enroute | holding. Errors and nulls mean "skip", so these
// return data, never decisions.
http.route({
  path: "/flights/holding",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request))
      return new Response("Unauthorized", { status: 401 });
    const project = new URL(request.url).searchParams.get("project");
    if (!project) return new Response("Missing ?project=", { status: 400 });
    try {
      const rows = await ctx.runQuery(internal.flights.holdingList, {
        projectName: project,
      });
      return Response.json(rows);
    } catch (err) {
      return new Response(err instanceof Error ? err.message : "Bad request", {
        status: 400,
      });
    }
  }),
});

http.route({
  path: "/flights/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request))
      return new Response("Unauthorized", { status: 401 });
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    const slug = url.searchParams.get("slug");
    if (!project || !slug)
      return new Response("Missing ?project= or ?slug=", { status: 400 });
    try {
      const row = await ctx.runQuery(internal.flights.statusBySlug, {
        projectName: project,
        slug,
      });
      // null strictly means "no flight ever existed for this slug".
      return Response.json(row);
    } catch (err) {
      return new Response(err instanceof Error ? err.message : "Bad request", {
        status: 400,
      });
    }
  }),
});

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
