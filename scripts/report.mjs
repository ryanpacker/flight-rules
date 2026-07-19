#!/usr/bin/env node
// One-shot reporter: gathers a project's state (worktrees, git position,
// PR list, port/process liveness) and POSTs a snapshot to the registry's
// HTTP action. Project config comes from the registry -- nothing
// machine-specific lives in this repo.
//
// Usage: node scripts/report.mjs <project-name>

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectName = process.argv[2];
if (!projectName) {
  console.error("Usage: node scripts/report.mjs <project-name>");
  process.exit(1);
}

// --- config ------------------------------------------------------------------

function parseEnvFile(path) {
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
    value = value.replace(/^(["'])(.*)\1$/, "$2");
    env[m[1]] = value;
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
  console.error(
    "Missing site URL or secret (set VITE_CONVEX_SITE_URL / VITE_FLIGHT_RULES_SECRET in .env.local).",
  );
  process.exit(1);
}

async function call(path, options = {}) {
  const res = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
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
}

// --- shell helpers -------------------------------------------------------------

function sh(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function git(cwd, ...args) {
  return sh("git", ["-C", cwd, ...args]);
}

function countLines(text) {
  return text ? text.split("\n").filter(Boolean).length : 0;
}

function tryConnect(port, host) {
  return new Promise((res) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.destroy();
      res(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(700, () => done(false));
  });
}

// Dev servers bind IPv4 or IPv6 depending on the tool; try both.
async function checkPort(port) {
  return (
    (await tryConnect(port, "127.0.0.1")) || (await tryConnect(port, "::1"))
  );
}

function listeningProcesses(port) {
  const out = sh("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fc"]);
  if (!out) return {};
  const processes = {};
  for (const line of out.split("\n")) {
    if (line.startsWith("c")) processes[line.slice(1)] = true;
  }
  return processes;
}

// --- gather --------------------------------------------------------------------

const project = await call(`/projects?name=${encodeURIComponent(projectName)}`);
const { repoPath, worktreeRoot, githubRepo, integrationBranch } = project;

function readPackageVersion(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
  } catch {
    return undefined;
  }
}

const tower = {
  branch: git(repoPath, "rev-parse", "--abbrev-ref", "HEAD") ?? "unknown",
  dirtyCount: countLines(git(repoPath, "status", "--porcelain")),
  unpushedCount: Number(
    git(repoPath, "rev-list", "--count", "@{upstream}..HEAD") ?? 0,
  ),
  devVersion: readPackageVersion(repoPath),
};

// PRs via gh (best-effort; reporter still works without it)
let prs = [];
const ghOut = sh("gh", [
  "pr",
  "list",
  "--repo",
  githubRepo,
  "--state",
  "all",
  "--limit",
  "50",
  "--json",
  "number,title,headRefName,state,isDraft,updatedAt",
]);
if (ghOut) {
  prs = JSON.parse(ghOut).map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRef: pr.headRefName,
    state: pr.state,
    isDraft: pr.isDraft,
    updatedAt: Date.parse(pr.updatedAt),
  }));
} else {
  console.warn("warning: `gh pr list` failed; reporting without PRs");
}

// Worktrees under worktreeRoot = flights
const worktrees = [];
const porcelain = git(repoPath, "worktree", "list", "--porcelain") ?? "";
let current = null;
for (const line of porcelain.split("\n")) {
  if (line.startsWith("worktree ")) {
    current = { path: line.slice("worktree ".length) };
    worktrees.push(current);
  } else if (line.startsWith("branch ") && current) {
    current.branch = line.slice("branch ".length).replace("refs/heads/", "");
  }
}

const flightWorktrees = worktrees.filter(
  (w) =>
    w.path !== repoPath &&
    (w.path + sep).startsWith(resolve(worktreeRoot) + sep),
);

const flights = [];
for (const wt of flightWorktrees) {
  const slug = basename(wt.path);
  const env = parseEnvFile(join(wt.path, ".env.local"));
  const port = env.PORT ? Number(env.PORT) : undefined;
  const deploymentName = env.CONVEX_DEPLOYMENT?.replace(/^dev:/, "");
  const branch = wt.branch ?? "detached";

  const counts = git(
    wt.path,
    "rev-list",
    "--left-right",
    "--count",
    `${integrationBranch}...HEAD`,
  );
  const [behind, ahead] = counts ? counts.split(/\s+/).map(Number) : [0, 0];

  const logOut = git(wt.path, "log", "-3", "--format=%h%x00%s") ?? "";
  const lastCommits = logOut
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject] = line.split("\0");
      return { sha, subject: subject ?? "" };
    });

  const listening = port !== undefined ? await checkPort(port) : undefined;
  const processes = port !== undefined ? listeningProcesses(port) : {};
  const pr = prs.find((p) => p.headRef === branch);

  flights.push({
    slug,
    worktreePath: wt.path,
    branch,
    port,
    deploymentName,
    report: {
      reportedAt: Date.now(),
      listening,
      processes,
      dirtyCount: countLines(git(wt.path, "status", "--porcelain")),
      ahead,
      behind,
      lastCommits,
      prNumber: pr?.number,
    },
  });
}

// --- post ----------------------------------------------------------------------

const snapshot = {
  projectName,
  reportedAt: Date.now(),
  tower,
  flights,
  prs,
};

await call("/report", { method: "POST", body: JSON.stringify(snapshot) });

console.log(`Reported ${projectName}:`);
console.log(
  `  tower: ${tower.branch} (${tower.dirtyCount} dirty, ${tower.unpushedCount} unpushed)`,
);
for (const f of flights) {
  const r = f.report;
  console.log(
    `  flight ${f.slug}: ${f.branch} ↑${r.ahead} ↓${r.behind}, ` +
      `${r.dirtyCount} dirty, port ${f.port ?? "?"} ${r.listening ? "listening" : "down"}` +
      (r.prNumber ? `, PR #${r.prNumber}` : ""),
  );
}
console.log(`  ${prs.length} PRs`);
console.log("Board: http://localhost:3999");
