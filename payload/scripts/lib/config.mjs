// Shared config resolution for payload scripts. <root> is two directories up
// from scripts/: the consumer checkout (or flight worktree) when installed at
// .flight-rules/scripts/, the flight-rules repo itself when run from
// payload/scripts/.
//
// Resolution order, most specific wins:
//   1. FLIGHT_RULES_SITE_URL / FLIGHT_RULES_SECRET / FLIGHT_RULES_PROJECT env
//   2. <root>/.flight-rules/config.json ({ "project": ..., "siteUrl": ... })
//   3. <root>/.env.local -- FLIGHT_RULES_* names, or the VITE_-prefixed names
//      the flight-rules repo uses for the board
// The secret never lives in config.json (it may be committed); only env or
// .env.local.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // strip trailing "# comment" (unquoted values only)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      value = value.replace(/\s+#.*$/, "");
    }
    env[m[1]] = value.replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

export function loadConfig(scriptUrl) {
  const root = resolve(dirname(fileURLToPath(scriptUrl)), "..", "..");
  const envLocal = parseEnvFile(join(root, ".env.local"));
  let fileConfig = {};
  const configPath = join(root, ".flight-rules", "config.json");
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      console.warn(`warning: could not parse ${configPath}`);
    }
  }
  return {
    root,
    siteUrl:
      process.env.FLIGHT_RULES_SITE_URL ??
      fileConfig.siteUrl ??
      envLocal.FLIGHT_RULES_SITE_URL ??
      envLocal.VITE_CONVEX_SITE_URL,
    secret:
      process.env.FLIGHT_RULES_SECRET ??
      envLocal.FLIGHT_RULES_SECRET ??
      envLocal.VITE_FLIGHT_RULES_SECRET,
    project: process.env.FLIGHT_RULES_PROJECT ?? fileConfig.project,
  };
}

// Returns a call(path, options) helper bound to the registry, exiting with a
// clear message if the connection config is incomplete.
export function registryClient(config) {
  if (!config.siteUrl || !config.secret) {
    console.error(
      "Missing registry config: set FLIGHT_RULES_SITE_URL and " +
        "FLIGHT_RULES_SECRET (env or .env.local), or siteUrl in " +
        ".flight-rules/config.json.",
    );
    process.exit(1);
  }
  return async function call(path, options = {}) {
    const res = await fetch(`${config.siteUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      throw new Error(
        `${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`,
      );
    }
    return res.json();
  };
}

export const BOARD_URL = "http://localhost:3999";
