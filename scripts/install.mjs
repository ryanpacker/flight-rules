#!/usr/bin/env node
// Install (or update) the Flight Rules payload in a consumer project.
//
//   node scripts/install.mjs <project-name> [--path <dir>]
//
// The target checkout is resolved from the registry (the project row's
// repoPath); --path overrides it for unregistered targets or testing.
//
// What it does, all inside the consumer repo:
//   .flight-rules/skills/   ← replaced with payload/skills/
//   .flight-rules/scripts/  ← replaced with payload/scripts/
//   .flight-rules/VERSION   ← stamped with this repo's package.json version
//   .flight-rules/config.json  created if missing ({ project, siteUrl });
//                              left untouched if present
//   .claude/skills/<name>   → relative symlink to ../../.flight-rules/skills/<name>
// The consumer commits all of it like ordinary files (symlinks are relative,
// so they work for every clone). Nothing else in .flight-rules/ is touched.

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseEnvFile,
  registryClient,
} from "../payload/scripts/lib/config.mjs";

const args = process.argv.slice(2);
const projectName = args[0];
if (!projectName || projectName.startsWith("--")) {
  console.error("Usage: node scripts/install.mjs <project-name> [--path <dir>]");
  process.exit(1);
}
const pathFlag = args.indexOf("--path");
const pathOverride = pathFlag === -1 ? undefined : args[pathFlag + 1];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const payloadDir = join(repoRoot, "payload");
const version = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
).version;

const env = parseEnvFile(join(repoRoot, ".env.local"));
const siteUrl =
  process.env.FLIGHT_RULES_SITE_URL ?? env.VITE_CONVEX_SITE_URL;
const secret =
  process.env.FLIGHT_RULES_SECRET ?? env.VITE_FLIGHT_RULES_SECRET;

// Resolve the target checkout.
let targetRoot = pathOverride && resolve(pathOverride);
if (!targetRoot) {
  const call = registryClient({ siteUrl, secret });
  const project = await call(
    `/projects?name=${encodeURIComponent(projectName)}`,
  );
  targetRoot = project.repoPath;
}
if (!existsSync(targetRoot)) {
  console.error(`Target does not exist: ${targetRoot}`);
  process.exit(1);
}

const frDir = join(targetRoot, ".flight-rules");
const previous = existsSync(join(frDir, "VERSION"))
  ? readFileSync(join(frDir, "VERSION"), "utf8").trim()
  : null;

// Replace the installer-owned subdirectories wholesale; leave everything
// else in .flight-rules/ (legacy v1 content, config.json) alone.
for (const sub of ["skills", "scripts"]) {
  const dest = join(frDir, sub);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(payloadDir, sub), dest, { recursive: true });
}
writeFileSync(join(frDir, "VERSION"), `${version}\n`);

const configPath = join(frDir, "config.json");
let configNote = "left untouched";
if (!existsSync(configPath)) {
  writeFileSync(
    configPath,
    `${JSON.stringify({ project: projectName, siteUrl }, null, 2)}\n`,
  );
  configNote = "created";
}

// Skills are exposed to tools via relative symlinks to the one real copy.
const skillNames = readdirSync(join(payloadDir, "skills"));
const claudeSkills = join(targetRoot, ".claude", "skills");
mkdirSync(claudeSkills, { recursive: true });
const linked = [];
const skipped = [];
for (const name of skillNames) {
  const linkPath = join(claudeSkills, name);
  const linkTarget = relative(claudeSkills, join(frDir, "skills", name));
  const existing = lstatSync(linkPath, { throwIfNoEntry: false });
  if (existing) {
    if (!existing.isSymbolicLink()) {
      skipped.push(name);
      continue;
    }
    unlinkSync(linkPath);
  }
  symlinkSync(linkTarget, linkPath);
  linked.push(name);
}

console.log(
  `Installed flight-rules ${version}` +
    (previous && previous !== version ? ` (was ${previous})` : "") +
    ` into ${targetRoot}`,
);
console.log(`  .flight-rules/skills, .flight-rules/scripts: replaced`);
console.log(`  .flight-rules/VERSION: ${version}`);
console.log(`  .flight-rules/config.json: ${configNote}`);
console.log(
  `  .claude/skills: ${linked.length ? `linked ${linked.join(", ")}` : "no new links"}`,
);
if (skipped.length) {
  console.log(
    `  warning: not symlinks, left alone: ${skipped
      .map((s) => `.claude/skills/${s}`)
      .join(", ")}`,
  );
}
console.log("Commit the changes in the consumer repo to finish.");
