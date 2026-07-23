#!/usr/bin/env node
// Flight lifecycle CLI: records lifecycle verbs with the Flight Rules
// registry at the moment of truth. This script only talks to the registry --
// creating and tearing down the worktree/env itself belongs to the consumer
// project's own tooling. Contract: docs/lifecycle-contract.md.
//
// Usage:
//   flight.mjs takeoff <slug> --branch <branch> --worktree <abs-path>
//                             [--port <n>] [--deployment <name>]
//   flight.mjs hold <slug>    [--pr <n>] [--fuel-hours <h>]
//   flight.mjs resume <slug>
//   flight.mjs divert <slug>  [--reason "..."]
//   flight.mjs land <slug>    [--pr <n>]
//   flight.mjs scrub <slug>   [--reason "..."]
//   flight.mjs status <slug>            (prints JSON; null = never existed)
//   flight.mjs holding                  (prints JSON list of holding flights)
//
// All verbs accept --project <name>; otherwise the project comes from
// FLIGHT_RULES_PROJECT or .flight-rules/config.json.

import { BOARD_URL, loadConfig, registryClient } from "./lib/config.mjs";

const MUTATION_VERBS = ["takeoff", "hold", "resume", "divert", "land", "scrub"];
const QUERY_VERBS = ["status", "holding"];

const [verb, ...argv] = process.argv.slice(2);

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    `Usage:
  flight.mjs takeoff <slug> --branch <branch> --worktree <abs-path> [--port <n>] [--deployment <name>]
  flight.mjs hold <slug>    [--pr <n>] [--fuel-hours <h>]
  flight.mjs resume <slug>
  flight.mjs divert <slug>  [--reason "..."]
  flight.mjs land <slug>    [--pr <n>]
  flight.mjs scrub <slug>   [--reason "..."]
  flight.mjs status <slug>  (JSON; null = no flight ever existed)
  flight.mjs holding        (JSON list of holding flights)

All verbs accept --project <name> (default: FLIGHT_RULES_PROJECT or .flight-rules/config.json).`,
  );
  process.exit(1);
}

if (![...MUTATION_VERBS, ...QUERY_VERBS].includes(verb)) {
  usage(verb ? `Unknown verb: ${verb}` : undefined);
}

// Every verb but `holding` takes a positional <slug> before the flags.
let slug;
let rest = argv;
if (verb !== "holding") {
  [slug, ...rest] = argv;
  if (!slug || slug.startsWith("--")) usage("Missing <slug>");
}

const flags = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  if (!key.startsWith("--") || rest[i + 1] === undefined) {
    usage(`Bad argument: ${key}`);
  }
  flags[key.slice(2)] = rest[i + 1];
}

const config = loadConfig(import.meta.url);
const projectName = flags.project ?? config.project;
if (!projectName) {
  usage(
    "No project name: pass --project or set FLIGHT_RULES_PROJECT / " +
      ".flight-rules/config.json",
  );
}
const call = registryClient(config);

try {
  if (QUERY_VERBS.includes(verb)) {
    const params = new URLSearchParams({ project: projectName });
    if (verb === "status") params.set("slug", slug);
    const result = await call(`/flights/${verb}?${params}`);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const body = { projectName, slug };
  if (verb === "takeoff") {
    if (!flags.branch) usage("takeoff requires --branch");
    if (!flags.worktree) usage("takeoff requires --worktree");
    body.branch = flags.branch;
    body.worktreePath = flags.worktree;
    if (flags.port !== undefined) body.port = Number(flags.port);
    if (flags.deployment) body.deploymentName = flags.deployment;
  } else if (verb === "hold") {
    if (flags.pr !== undefined) body.prNumber = Number(flags.pr);
    if (flags["fuel-hours"] !== undefined) {
      body.fuelHours = Number(flags["fuel-hours"]);
    }
  } else if (verb === "divert" || verb === "scrub") {
    if (flags.reason) body.reason = flags.reason;
  } else if (verb === "land") {
    if (flags.pr !== undefined) body.prNumber = Number(flags.pr);
  }

  const res = await call(`/flights/${verb}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  // Divert is called blind at teardown; the registry no-ops when nothing is
  // open (already landed/scrubbed, or no flight at all). Say so instead of
  // claiming a divert happened.
  if (verb === "divert" && res.result === null) {
    console.log(`Flight ${slug} already closed or unknown — nothing to divert (${projectName}).`);
    process.exit(0);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const PAST = {
  takeoff: "enroute",
  hold: "holding",
  resume: "enroute",
  divert: "diverted",
  land: "landed",
  scrub: "scrubbed",
};
console.log(`Flight ${slug} ${PAST[verb]} (${projectName}).`);
console.log(`Board: ${BOARD_URL}/p/${encodeURIComponent(projectName)}`);
