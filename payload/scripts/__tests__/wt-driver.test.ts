/**
 * Structural tests for the spec 1.1 parallel-worktree driver.
 *
 * 1. The deletion test, executable form: the driver (wt.sh + wt/lib.sh)
 *    must contain no project/provider vocabulary — that all belongs in the
 *    consumer's hooks dir (flightrules.config.json → hooksDir). If this
 *    test fails, the fix is to move the offending logic into a hook, not
 *    to edit the word list. One deliberate carve-out: "deployment" is
 *    Flight Rules vocabulary (the archetype's optional per-flight backend
 *    deployment; flights.deploymentName in the registry schema), so the
 *    /deploy/ pattern excludes that one word — "deploy", "deploy key",
 *    provider deploy commands all still fail.
 * 2. Lifecycle against a scratch git repo with fake hooks: claim → create →
 *    hooks → status → remove, the --pr publish gate, the 13.2 teardown
 *    hardening, stale-claim reconciliation, a concurrent-claim race, and
 *    best-effort registry recording via sibling payload scripts.
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const PAYLOAD_SCRIPTS = path.join(REPO_ROOT, "payload", "scripts");
const DRIVER_FILES = [
  path.join(PAYLOAD_SCRIPTS, "wt.sh"),
  path.join(PAYLOAD_SCRIPTS, "wt", "lib.sh"),
];

describe("deletion test — the driver is generic", () => {
  const forbidden = [
    /convex/i,
    /workos/i,
    /\bnpm\b/i,
    /\bnpx\b/i,
    /\bpnpm\b/i,
    /\bvite\b/i,
    /playwright/i,
    /seed/i,
    /deploy(?!ment)/i, // "deployment" alone is FR archetype vocabulary
    /bamboohr/i,
    /vercel/i,
    /\bauth/i,
    /e2e/i,
    /1password/i,
    /\bop read\b/i,
  ];

  for (const file of DRIVER_FILES) {
    it(`${path.relative(REPO_ROOT, file)} contains no provider vocabulary`, () => {
      const text = fs.readFileSync(file, "utf8");
      for (const re of forbidden) {
        const match = text.match(re);
        expect(
          match,
          `driver file references "${match?.[0]}" — move that logic into a hook`,
        ).toBeNull();
      }
    });
  }
});

describe("driver lifecycle (scratch repo, fake hooks)", () => {
  let tmp: string;
  let origin: string; // bare remote
  let repo: string; // scratch main checkout containing driver + config + hooks
  let wtRoot: string; // scratch worktreesRoot
  let hookLog: string;
  let ghLog: string;
  let regLog: string; // registry-recording log (fake flight.mjs / report.mjs)
  let binDir: string; // PATH shim dir (stub gh)

  const PORT_BASE = 3900;

  function run(args: Array<string>, opts: { env?: Record<string, string>; cwd?: string } = {}) {
    return execFileSync("bash", [path.join(repo, "scripts", "wt.sh"), ...args], {
      cwd: opts.cwd ?? repo,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        FR_NONINTERACTIVE: "1",
        HOOKLOG: hookLog,
        GHLOG: ghLog,
        REGLOG: regLog,
        ...opts.env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  function runAsync(args: Array<string>) {
    return execFileAsync("bash", [path.join(repo, "scripts", "wt.sh"), ...args], {
      cwd: repo,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        FR_NONINTERACTIVE: "1",
        HOOKLOG: hookLog,
        GHLOG: ghLog,
        REGLOG: regLog,
      },
      encoding: "utf8",
    });
  }

  function git(cwd: string, ...args: Array<string>) {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  }

  function hookLines(): Array<string> {
    return fs.existsSync(hookLog)
      ? fs.readFileSync(hookLog, "utf8").trim().split("\n").filter(Boolean)
      : [];
  }

  function regLines(): Array<string> {
    return fs.existsSync(regLog)
      ? fs.readFileSync(regLog, "utf8").trim().split("\n").filter(Boolean)
      : [];
  }

  function writeHook(name: string, body: string) {
    const p = path.join(repo, "hooks", name);
    fs.writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
    fs.chmodSync(p, 0o755);
  }

  function claimDirs(): Array<string> {
    const claims = path.join(wtRoot, ".claims");
    return fs.existsSync(claims)
      ? fs.readdirSync(claims).filter((d) => d.startsWith("slot-"))
      : [];
  }

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wt-driver-test-"));
    origin = path.join(tmp, "origin.git");
    repo = path.join(tmp, "repo");
    wtRoot = path.join(tmp, "wts");
    hookLog = path.join(tmp, "hooks.log");
    ghLog = path.join(tmp, "gh.log");
    regLog = path.join(tmp, "registry.log");
    binDir = path.join(tmp, "bin");

    execFileSync("git", ["init", "--bare", "--initial-branch=dev", origin]);
    execFileSync("git", ["clone", origin, repo], { stdio: "ignore" });
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    fs.writeFileSync(path.join(repo, "README.md"), "scratch\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-m", "init");
    git(repo, "push", "origin", "HEAD:dev");
    git(repo, "checkout", "-B", "dev", "origin/dev");

    // driver + config + fake hooks travel in the scratch repo
    fs.mkdirSync(path.join(repo, "scripts", "wt"), { recursive: true });
    fs.mkdirSync(path.join(repo, "hooks"));
    for (const f of DRIVER_FILES) {
      const dest = path.join(repo, "scripts", path.relative(PAYLOAD_SCRIPTS, f));
      fs.copyFileSync(f, dest);
      fs.chmodSync(dest, 0o755);
    }
    fs.writeFileSync(
      path.join(repo, "flightrules.config.json"),
      JSON.stringify({
        baseBranch: "dev",
        portBase: PORT_BASE,
        maxSlots: 10,
        copyEnvFiles: false,
        worktreesRoot: wtRoot,
        hooksDir: "hooks",
      }),
    );

    const trace = (name: string) =>
      `echo "${name} slug=$FR_SLUG slot=$FR_SLOT port=$FR_PORT base=$FR_BASE_SHA wt=$FR_WORKTREE_PATH claim=$FR_CLAIM_DIR main=$FR_MAIN_PATH empty=\${FR_OPT_EMPTY:-} claimjson=$([[ -f $FR_CLAIM_DIR/claim.json ]] && echo yes || echo no) cwd=$PWD" >>"$HOOKLOG"`;
    // post-create can report a backend deployment name (the meta/deployment
    // convention the driver patches into the takeoff record).
    writeHook(
      "post-create",
      `${trace("post-create")}\n[[ -n "\${DEPLOY_NAME:-}" ]] && printf '%s' "$DEPLOY_NAME" >"$FR_CLAIM_DIR/meta/deployment"\nexit 0`,
    );
    writeHook("pre-ready", trace("pre-ready"));
    writeHook(
      "pre-finish",
      `${trace("pre-finish")}\n[[ "\${FAIL_PREFINISH:-}" == 1 ]] && exit 1\nexit 0`,
    );
    // pre-remove drops a late artifact into the worktree to simulate a dying
    // process still writing files at removal time (13.2 hardening).
    writeHook(
      "pre-remove",
      `${trace("pre-remove")}\n[[ -n "$FR_WORKTREE_PATH" && -d "$FR_WORKTREE_PATH" ]] && touch "$FR_WORKTREE_PATH/late-artifact.tmp"\nexit 0`,
    );
    writeHook("post-remove", trace("post-remove"));

    // stub gh: `pr list` prints $GH_MERGED (the merged-PR number) or nothing;
    // everything else behaves like `pr create` and prints a PR URL
    fs.mkdirSync(binDir);
    const gh = path.join(binDir, "gh");
    fs.writeFileSync(
      gh,
      `#!/usr/bin/env bash
echo "gh $*" >>"$GHLOG"
if [[ "$1 $2" == "pr list" ]]; then
  [[ -n "\${GH_MERGED:-}" ]] && echo "$GH_MERGED"
  exit 0
fi
echo "https://github.com/example/repo/pull/99"
`,
    );
    fs.chmodSync(gh, 0o755);
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("up: claims slot 1, creates worktree from origin/dev, runs hooks in order with the contract env", () => {
    const out = run(["up", "alpha", "--empty"]);
    expect(out).toContain("READY: slug=alpha slot=1 port=3901");

    const lines = hookLines();
    expect(lines.map((l) => l.split(" ")[0])).toEqual(["post-create", "pre-ready"]);

    const baseSha = git(repo, "rev-parse", "origin/dev");
    const wt = path.join(wtRoot, "alpha");
    for (const line of lines) {
      expect(line).toContain("slug=alpha");
      expect(line).toContain("slot=1");
      expect(line).toContain(`port=${PORT_BASE + 1}`);
      expect(line).toContain(`base=${baseSha}`);
      expect(line).toContain(`wt=${wt}`);
      expect(line).toContain("empty=1");
      expect(line).toContain("claimjson=yes"); // record-before-mutate
      expect(line).toContain(`cwd=${wt}`); // hooks run inside the worktree
    }

    expect(fs.existsSync(wt)).toBe(true);
    expect(git(wt, "rev-parse", "--abbrev-ref", "HEAD")).toBe("alpha");
    expect(git(wt, "rev-parse", "HEAD")).toBe(baseSha);

    const claim = JSON.parse(
      fs.readFileSync(path.join(wtRoot, ".claims", "slot-1", "claim.json"), "utf8"),
    );
    expect(claim).toMatchObject({
      slug: "alpha",
      branch: "alpha",
      slot: 1,
      port: PORT_BASE + 1,
      status: "ready",
      baseSha,
      worktree: wt,
    });
  });

  it("up: re-running resumes the same claim instead of taking a new slot", () => {
    fs.rmSync(hookLog, { force: true });
    const out = run(["up", "alpha", "--empty"]);
    expect(out).toContain("resuming slot 1");
    expect(out).toContain("READY: slug=alpha slot=1");
    expect(claimDirs()).toEqual(["slot-1"]);
  });

  it("status: table and --json report the claim", () => {
    const table = run(["status"]);
    expect(table).toContain("alpha");
    expect(table).toContain("3901");

    const json = JSON.parse(run(["status", "--json"]));
    const alpha = json.find((r: { slug: string }) => r.slug === "alpha");
    expect(alpha).toMatchObject({
      slot: 1,
      port: PORT_BASE + 1,
      status: "ready",
      worktreePresent: true,
      stale: false,
    });
  });

  it("down: refuses a dirty tree, then removes cleanly despite late runtime artifacts (13.2)", () => {
    const wt = path.join(wtRoot, "alpha");
    fs.writeFileSync(path.join(wt, "uncommitted.txt"), "dirty");
    expect(() => run(["down", "alpha"])).toThrow(/uncommitted changes/);
    expect(fs.existsSync(wt)).toBe(true); // left intact

    fs.rmSync(path.join(wt, "uncommitted.txt"));
    fs.rmSync(hookLog, { force: true });
    const out = run(["down", "alpha"]);
    // the fake pre-remove hook dropped late-artifact.tmp into the tree;
    // removal must still succeed and report success
    expect(out).toContain("done — slot 1 released");
    expect(out).toContain("branch alpha kept");
    expect(hookLines().map((l) => l.split(" ")[0])).toEqual(["pre-remove", "post-remove"]);
    expect(fs.existsSync(wt)).toBe(false);
    expect(claimDirs()).toEqual([]);
    expect(git(repo, "branch", "--list", "alpha")).toContain("alpha"); // kept by default
  });

  it("down --pr: pre-finish gates, pushes, records the PR, then tears down", () => {
    run(["up", "beta", "--empty"]);
    const wt = path.join(wtRoot, "beta");
    fs.writeFileSync(path.join(wt, "change.txt"), "work\n");
    git(wt, "add", "change.txt");
    git(wt, "commit", "-m", "feat: work");

    // gate failure aborts with everything intact
    expect(() => run(["down", "beta", "--pr"], { env: { FAIL_PREFINISH: "1" } })).toThrow(
      /pre-finish gates failed/,
    );
    expect(fs.existsSync(wt)).toBe(true);

    fs.rmSync(hookLog, { force: true });
    const out = run(["down", "beta", "--pr", "--delete-branch"]);
    expect(out).toContain("https://github.com/example/repo/pull/99");
    expect(fs.readFileSync(ghLog, "utf8")).toContain("gh pr create --base dev --head beta");
    const order = hookLines().map((l) => l.split(" ")[0]);
    expect(order).toEqual(["pre-finish", "pre-remove", "post-remove"]);
    expect(git(origin, "rev-parse", "refs/heads/beta")).toBeTruthy(); // pushed before teardown
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(repo, "branch", "--list", "beta")).toBe(""); // --delete-branch
  });

  it("reconciliation: a claim whose worktree vanished is reported stale and prune releases it", () => {
    run(["up", "gamma", "--empty"]);
    const wt = path.join(wtRoot, "gamma");
    fs.rmSync(wt, { recursive: true, force: true }); // simulate manual rm -rf

    const json = JSON.parse(run(["status", "--json"]));
    const gamma = json.find((r: { slug: string }) => r.slug === "gamma");
    expect(gamma.stale).toBe(true);

    const out = run(["prune", "gamma"]);
    expect(out).toContain("pruned");
    expect(claimDirs()).toEqual([]);
    // leftover branch cleanup for later tests
    git(repo, "branch", "-D", "gamma");
    git(repo, "worktree", "prune");
  });

  it("registry: takeoff on create, deployment patched in from meta/, divert on down, scrub only when the branch is deleted", () => {
    // Fake registry scripts next to the driver switch recording on — the
    // driver calls them best-effort; before this test they were absent and
    // every lifecycle ran fine without them.
    fs.writeFileSync(
      path.join(repo, "scripts", "flight.mjs"),
      `import fs from "node:fs";\n` +
        `fs.appendFileSync(process.env.REGLOG, ` +
        `\`flight \${process.argv.slice(2).join(" ")} cwd=\${process.cwd()}\\n\`);\n`,
    );
    fs.writeFileSync(
      path.join(repo, "scripts", "report.mjs"),
      `import fs from "node:fs";\nfs.appendFileSync(process.env.REGLOG, "report\\n");\n`,
    );

    // registry scripts run from the main checkout (cd resolves symlinks,
    // hence realpath)
    const mainCwd = fs.realpathSync(repo);

    // up with a hook-reported deployment: takeoff, patch, report
    run(["up", "delta", "--empty"], { env: { DEPLOY_NAME: "brave-otter-42" } });
    const wt = path.join(wtRoot, "delta");
    let lines = regLines();
    expect(lines).toEqual([
      `flight takeoff delta --branch delta --worktree ${wt} --port ${PORT_BASE + 1} cwd=${mainCwd}`,
      `flight takeoff delta --branch delta --worktree ${wt} --port ${PORT_BASE + 1} --deployment brave-otter-42 cwd=${mainCwd}`,
      "report",
    ]);

    // plain down: teardown never decides the flight's fate — it records a
    // divert (env down, branch kept, row stays on the board), no gh query
    fs.rmSync(regLog, { force: true });
    run(["down", "delta"]);
    expect(regLines()).toEqual([
      `flight divert delta --reason worktree removed cwd=${mainCwd}`,
      "report",
    ]);
    git(repo, "branch", "-D", "delta"); // kept by default; cleanup for later tests

    // up without a deployment: single takeoff (no patch), report
    fs.rmSync(regLog, { force: true });
    run(["up", "epsilon", "--empty"]);
    lines = regLines();
    expect(lines).toEqual([
      `flight takeoff epsilon --branch epsilon --worktree ${path.join(wtRoot, "epsilon")} --port ${PORT_BASE + 1} cwd=${mainCwd}`,
      "report",
    ]);

    // down --delete-branch: deleting the branch is the caller declaring
    // abandonment — the one teardown that records a scrub
    fs.rmSync(regLog, { force: true });
    run(["down", "epsilon", "--delete-branch"]);
    expect(regLines()).toEqual([
      `flight scrub epsilon --reason branch deleted cwd=${mainCwd}`,
      "report",
    ]);
  });

  it("race: concurrent ups claim distinct slots", { timeout: 60_000 }, async () => {
    const slugs = ["r-one", "r-two", "r-three", "r-four", "r-five", "r-six"];
    const results = await Promise.all(slugs.map((s) => runAsync(["up", s, "--empty"])));
    const slots = results
      .map((r) => r.stdout.match(/READY: slug=\S+ slot=(\d+)/)?.[1])
      .filter(Boolean);
    expect(slots).toHaveLength(slugs.length);
    expect(new Set(slots).size).toBe(slugs.length);
    for (const s of slugs) run(["down", s, "--delete-branch"]);
    expect(claimDirs()).toEqual([]);
  });
});
