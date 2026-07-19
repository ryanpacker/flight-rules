#!/usr/bin/env node
// One-shot reporter: gathers a project's state (worktrees, git position,
// PR list, port/process liveness) and POSTs a snapshot to the registry's
// HTTP action. Project config comes from the registry -- nothing
// machine-specific lives in the flight-rules repo.
//
// Usage: report.mjs [project-name]
// (project defaults to FLIGHT_RULES_PROJECT or .flight-rules/config.json)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import { basename, join, resolve, sep } from "node:path";

import {
  BOARD_URL,
  loadConfig,
  parseEnvFile,
  registryClient,
} from "./lib/config.mjs";

const config = loadConfig(import.meta.url);
const projectName = process.argv[2] ?? config.project;
if (!projectName) {
  console.error(
    "Usage: report.mjs [project-name] (or set FLIGHT_RULES_PROJECT / " +
      ".flight-rules/config.json)",
  );
  process.exit(1);
}
const call = registryClient(config);

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

// How to read a flight's env from its worktree is consumer-specific and
// comes from the consumer's flightrules.config.json ("report" block):
//   portVar                env var holding the dev-server port (default PORT)
//   deploymentVar          env var holding the backend deployment name
//                          (no default -- naming it names the provider)
//   deploymentStripPrefix  prefix to strip from that value (e.g. a CLI's
//                          type tag); the rest stays raw per the
//                          link-derivation rule
let reportConfig = {};
try {
  reportConfig =
    JSON.parse(readFileSync(join(repoPath, "flightrules.config.json"), "utf8"))
      .report ?? {};
} catch {
  // no consumer config -- defaults below
}
const portVar = reportConfig.portVar ?? "PORT";
const { deploymentVar, deploymentStripPrefix } = reportConfig;

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
  "number,title,headRefName,state,isDraft,updatedAt,createdAt,mergedAt,closedAt",
]);
if (ghOut) {
  const ts = (value) => (value ? Date.parse(value) : undefined);
  prs = JSON.parse(ghOut).map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRef: pr.headRefName,
    state: pr.state,
    isDraft: pr.isDraft,
    updatedAt: Date.parse(pr.updatedAt),
    createdAt: ts(pr.createdAt),
    mergedAt: ts(pr.mergedAt),
    closedAt: ts(pr.closedAt),
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
  const port = env[portVar] ? Number(env[portVar]) : undefined;
  let deploymentName = deploymentVar ? env[deploymentVar] : undefined;
  if (
    deploymentName &&
    deploymentStripPrefix &&
    deploymentName.startsWith(deploymentStripPrefix)
  ) {
    deploymentName = deploymentName.slice(deploymentStripPrefix.length);
  }
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
console.log(`Board: ${BOARD_URL}/p/${encodeURIComponent(projectName)}`);
