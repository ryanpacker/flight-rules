#!/usr/bin/env node
// Seed or update a project row in the registry. Machine-specific values are
// passed as flags at run time -- they live in the Convex DB, never in git.
//
// Usage:
//   node scripts/seed.mjs --name my-project \
//     --repo-path /abs/path/to/checkout \
//     --worktree-root /abs/path/to/worktrees \
//     --github-repo owner/name \
//     [--integration-branch main] [--prod-url https://...] \
//     [--port-template "http://localhost:{port}"] \
//     [--deployment-template "https://dashboard.convex.dev/d/{deployment}"]

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!key.startsWith("--") || process.argv[i + 1] === undefined) {
    console.error(`Bad argument: ${key}`);
    process.exit(1);
  }
  args[key.slice(2)] = process.argv[i + 1];
}

const required = ["name", "repo-path", "worktree-root", "github-repo"];
for (const key of required) {
  if (!args[key]) {
    console.error(`Missing --${key}`);
    process.exit(1);
  }
}

function parseEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2]
      .trim()
      .replace(/\s+#.*$/, "")
      .replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localEnv = parseEnvFile(join(repoRoot, ".env.local"));
const siteUrl =
  process.env.FLIGHT_RULES_SITE_URL ?? localEnv.VITE_CONVEX_SITE_URL;
const secret =
  process.env.FLIGHT_RULES_SECRET ?? localEnv.VITE_FLIGHT_RULES_SECRET;
if (!siteUrl || !secret) {
  console.error("Missing site URL or secret in .env.local / environment.");
  process.exit(1);
}

const project = {
  name: args.name,
  repoPath: resolve(args["repo-path"]),
  worktreeRoot: resolve(args["worktree-root"]),
  githubRepo: args["github-repo"],
  integrationBranch: args["integration-branch"] ?? "main",
  ...(args["prod-url"] ? { prodUrl: args["prod-url"] } : {}),
  templates: {
    port: args["port-template"] ?? "http://localhost:{port}",
    deployment:
      args["deployment-template"] ??
      "https://dashboard.convex.dev/d/{deployment}",
  },
};

const res = await fetch(`${siteUrl}/projects`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(project),
});
if (!res.ok) {
  console.error(`Seed failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`Seeded project "${project.name}"`, await res.json());
