import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";

import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";

export type BoardData = FunctionReturnType<typeof api.board.get>;
export type ProjectData = BoardData[number];
export type Project = ProjectData["project"];
export type Flight = ProjectData["flights"][number];
export type Pr = ProjectData["prs"][number];
export type BoardEvent = ProjectData["events"][number];

// --- data -------------------------------------------------------------------

const secret = import.meta.env.VITE_FLIGHT_RULES_SECRET as string | undefined;
export const hasSecret = Boolean(secret);

export function useBoard(): BoardData | undefined {
  return useQuery(api.board.get, secret ? { secret } : "skip");
}

// Convex subscribes in the browser only; render a shell during SSR.
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// --- link derivation: raw identifiers in, URLs out --------------------------

export function portUrl(project: Project, port: number) {
  return project.templates.port.replace("{port}", String(port));
}
export function deploymentUrl(project: Project, deployment: string) {
  return project.templates.deployment.replace("{deployment}", deployment);
}
export function branchUrl(project: Project, branch: string) {
  return `https://github.com/${project.githubRepo}/tree/${encodeURIComponent(branch)}`;
}
export function prUrl(project: Project, number: number) {
  return `https://github.com/${project.githubRepo}/pull/${number}`;
}
export function commitUrl(project: Project, sha: string) {
  return `https://github.com/${project.githubRepo}/commit/${sha}`;
}
export function repoUrl(project: Project) {
  return `https://github.com/${project.githubRepo}`;
}

// --- freshness tiers --------------------------------------------------------

export const AGING_MS = 10 * 60_000;
export const STALE_MS = 30 * 60_000;
export const DORMANT_MS = 24 * 3_600_000;

export type Tier = "fresh" | "aging" | "stale" | "never";

export function reportTier(reportedAt: number | undefined, now: number): Tier {
  if (reportedAt === undefined) return "never";
  const age = now - reportedAt;
  if (age >= STALE_MS) return "stale";
  if (age >= AGING_MS) return "aging";
  return "fresh";
}

// Minutes are the finest grain shown: reports arrive every few minutes, so
// second-level precision is noise. A fresh report reads "0m ago".
export function formatAge(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// --- derived stats ----------------------------------------------------------

export function projectStats(d: ProjectData, now: number) {
  // Stable sort: takeoff time ascending; attention is color, not position.
  const flights = d.flights
    .filter((f) => f.status === "airborne")
    .sort((a, b) => a.createdAt - b.createdAt);
  let listening = 0;
  let down = 0;
  let stale = 0;
  let noReport = 0;
  let freshest: number | undefined;
  for (const f of flights) {
    const r = f.report;
    if (!r) {
      noReport++;
      continue;
    }
    if (r.listening === true) listening++;
    else if (r.listening === false) down++;
    if (now - r.reportedAt >= STALE_MS) stale++;
    freshest = Math.max(freshest ?? 0, r.reportedAt);
  }
  if (d.tower) freshest = Math.max(freshest ?? 0, d.tower.reportedAt);
  const openPrs = d.prs.filter((p) => p.state === "OPEN");
  const draftPrs = openPrs.filter((p) => p.isDraft).length;
  const dormant = freshest !== undefined && now - freshest >= DORMANT_MS;
  return {
    flights,
    listening,
    down,
    stale,
    noReport,
    freshest,
    openPrs: openPrs.length,
    draftPrs,
    dormant,
  };
}

const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export function countNoun(
  n: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${WORDS[n] ?? n} ${n === 1 ? singular : plural}`;
}

// --- enter/exit-only animation ---------------------------------------------

// Returns a display value that lags the live query by at most one render.
// When row membership changes (takeoff / landing / scrub), the state commit is
// wrapped in a view transition; in-place value updates pass through with no
// motion. Guarded for prefers-reduced-motion and browser support.
export function useRowTransitions<T>(
  next: T | undefined,
  rowKey: (value: T) => string,
): T | undefined {
  const [shown, setShown] = useState<T | undefined>(undefined);
  const shownRef = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (next === undefined || shownRef.current === next) return;
    const prev = shownRef.current;
    shownRef.current = next;
    const membershipChanged =
      prev !== undefined && rowKey(prev) !== rowKey(next);
    const reduceMotion =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (membershipChanged && !reduceMotion && document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => setShown(next));
      });
    } else {
      setShown(next);
    }
  });
  return shown ?? next;
}

// Focus the page title on client-side navigation (not on initial load),
// mirroring the prototype's route handler.
let navigatedBefore = false;
export function useFocusTitle() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (navigatedBefore) ref.current?.focus({ preventScroll: true });
    navigatedBefore = true;
  }, []);
  return ref;
}

// --- shared class fragments --------------------------------------------------

export const microlabel =
  "text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-3";
export const mono = "font-mono text-[0.93em]";
const badgeBase =
  "inline-block rounded-[3px] px-1.5 py-px font-sans text-[10.5px] tracking-[0.07em] uppercase";

// --- shared pieces ------------------------------------------------------------

export function ExtLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={title}
    >
      {children}
    </a>
  );
}

const DOT_BG = {
  good: "bg-good",
  crit: "bg-crit",
  warn: "bg-warn",
} as const;

export function Dot({ tone }: { tone: "good" | "crit" | "warn" | "none" }) {
  if (tone === "none") {
    return (
      <span className="mr-[7px] inline-block size-[7px] rounded-full border-[1.5px] border-dashed border-ink-3" />
    );
  }
  return (
    <span
      className={`mr-[7px] inline-block size-2 rounded-full ${DOT_BG[tone]}`}
    />
  );
}

export function StaleBadge() {
  return (
    <span
      className={`${badgeBase} border border-warn-line bg-warn-bg font-bold text-warn`}
    >
      stale
    </span>
  );
}
export function AgingBadge() {
  return (
    <span
      className={`${badgeBase} border border-warn-line bg-transparent font-[650] text-warn`}
    >
      aging
    </span>
  );
}
export function SilentBadge() {
  return (
    <span
      className={`${badgeBase} border border-dashed border-ink-3 bg-transparent font-bold text-ink-3`}
    >
      no report yet
    </span>
  );
}
export function QuietBadge({ age }: { age: string }) {
  return (
    <span
      className={`${badgeBase} ml-[7px] border border-warn-line bg-warn-bg font-bold text-warn`}
    >
      quiet {age}
    </span>
  );
}

// --- masthead ----------------------------------------------------------------

function Frag({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return warn ? (
    <span className="font-semibold text-warn">{children}</span>
  ) : (
    <span>{children}</span>
  );
}

export function joinFrags(frags: Array<ReactNode>) {
  return frags.flatMap((f, i) => (i === 0 ? [f] : [" · ", f]));
}

export function Masthead({
  data,
  now,
}: {
  data: BoardData | undefined;
  now: number;
}) {
  let tally: ReactNode = null;
  if (data && data.length > 0) {
    const stats = data.map((d) => projectStats(d, now));
    const sum = (pick: (s: (typeof stats)[number]) => number) =>
      stats.reduce((acc, s) => acc + pick(s), 0);
    const flights = sum((s) => s.flights.length);
    const listening = sum((s) => s.listening);
    const down = sum((s) => s.down);
    const stale = sum((s) => s.stale);
    const noReport = sum((s) => s.noReport);
    const openPrs = sum((s) => s.openPrs);
    const draftPrs = sum((s) => s.draftPrs);
    const frags: Array<ReactNode> = [
      <Frag key="p">
        {data.length} {data.length === 1 ? "project" : "projects"}
      </Frag>,
      <Frag key="f">
        {flights} {flights === 1 ? "flight" : "flights"}
      </Frag>,
    ];
    if (listening > 0) frags.push(<Frag key="l">{listening} listening</Frag>);
    if (down > 0) frags.push(<Frag key="d">{down} down</Frag>);
    if (stale > 0)
      frags.push(
        <Frag key="s" warn>
          {stale} stale
        </Frag>,
      );
    if (noReport > 0)
      frags.push(
        <Frag key="n" warn>
          {noReport} never reported
        </Frag>,
      );
    frags.push(
      <Frag key="pr">
        {openPrs === 0
          ? "no open PRs"
          : `${openPrs} open ${openPrs === 1 ? "PR" : "PRs"}${
              draftPrs > 0 ? ` (${draftPrs} draft)` : ""
            }`}
      </Frag>,
    );
    tally = (
      <span className="ml-auto text-[12.5px] text-ink-2 tabular-nums max-[960px]:ml-0 max-[960px]:w-full">
        {joinFrags(frags)}
      </span>
    );
  }
  return (
    <header className="flex flex-wrap items-baseline gap-4 border-b border-hairline pt-6 pb-3.5">
      <span className="text-xs font-[650] tracking-[0.14em] uppercase text-ink">
        Flight Rules
      </span>
      {tally}
    </header>
  );
}
