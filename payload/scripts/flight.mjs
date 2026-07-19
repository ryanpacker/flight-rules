#!/usr/bin/env node
// Flight lifecycle CLI: registers takeoff / land / scrub with the Flight
// Rules registry at the moment of truth. This script only talks to the
// registry -- creating and tearing down the worktree/env itself belongs to
// the consumer project's own tooling.
//
// Usage:
//   flight.mjs takeoff <slug> --branch <branch> --worktree <abs-path>
//                             [--port <n>] [--deployment <name>]
//   flight.mjs land <slug>    [--pr <n>]
//   flight.mjs scrub <slug>   [--reason "..."]
//
// All verbs accept --project <name>; otherwise the project comes from
// FLIGHT_RULES_PROJECT or .flight-rules/config.json.

import { BOARD_URL, loadConfig, registryClient } from "./lib/config.mjs";

const [verb, slug, ...rest] = process.argv.slice(2);
const VERBS = ["takeoff", "land", "scrub"];

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    `Usage:
  flight.mjs takeoff <slug> --branch <branch> --worktree <abs-path> [--port <n>] [--deployment <name>]
  flight.mjs land <slug>    [--pr <n>]
  flight.mjs scrub <slug>   [--reason "..."]

All verbs accept --project <name> (default: FLIGHT_RULES_PROJECT or .flight-rules/config.json).`,
  );
  process.exit(1);
}

if (!VERBS.includes(verb)) usage(verb ? `Unknown verb: ${verb}` : undefined);
if (!slug || slug.startsWith("--")) usage("Missing <slug>");

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

const body = { projectName, slug };
if (verb === "takeoff") {
  if (!flags.branch) usage("takeoff requires --branch");
  if (!flags.worktree) usage("takeoff requires --worktree");
  body.branch = flags.branch;
  body.worktreePath = flags.worktree;
  if (flags.port !== undefined) body.port = Number(flags.port);
  if (flags.deployment) body.deploymentName = flags.deployment;
} else if (verb === "land") {
  if (flags.pr !== undefined) body.prNumber = Number(flags.pr);
} else if (verb === "scrub") {
  if (flags.reason) body.reason = flags.reason;
}

try {
  await call(`/flights/${verb}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const PAST = { takeoff: "airborne", land: "landed", scrub: "scrubbed" };
console.log(`Flight ${slug} ${PAST[verb]} (${projectName}).`);
console.log(`Board: ${BOARD_URL}/p/${encodeURIComponent(projectName)}`);
