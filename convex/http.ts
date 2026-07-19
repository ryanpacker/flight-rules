import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function authorized(request: Request): boolean {
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const expected = process.env.FLIGHT_RULES_SECRET;
  return Boolean(expected) && token === expected;
}

// Reporter posts a full snapshot here.
http.route({
  path: "/report",
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
      await ctx.runMutation(internal.report.ingest, body as never);
    } catch (err) {
      return new Response(err instanceof Error ? err.message : "Bad request", {
        status: 400,
      });
    }
    return Response.json({ ok: true });
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

// Seed / update a project row.
http.route({
  path: "/projects",
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
      const id = await ctx.runMutation(internal.projects.upsert, body as never);
      return Response.json({ ok: true, id });
    } catch (err) {
      return new Response(err instanceof Error ? err.message : "Bad request", {
        status: 400,
      });
    }
  }),
});

export default http;
