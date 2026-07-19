import { Link, createFileRoute } from "@tanstack/react-router";

import {
  Masthead,
  QuietBadge,
  countNoun,
  formatAge,
  hasSecret,
  joinFrags,
  microlabel,
  mono,
  projectStats,
  useBoard,
  useFocusTitle,
  useMounted,
  useNow,
  useRowTransitions,
} from "../lib/board";

import type { BoardData, ProjectData } from "../lib/board";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function homeKey(data: BoardData) {
  return data
    .map((d) => d.project._id)
    .sort()
    .join();
}

function HomePage() {
  const mounted = useMounted();
  const now = useNow();
  const raw = useBoard();
  const data = useRowTransitions(mounted ? raw : undefined, homeKey);

  return (
    <div className="mx-auto max-w-[1360px] px-8 pb-[72px]">
      <Masthead data={data} now={now} />
      {mounted ? <Home data={data} now={now} /> : <Quiet>Connecting…</Quiet>}
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="mt-10 text-[13px] text-ink-3">{children}</p>;
}

function Home({ data, now }: { data: BoardData | undefined; now: number }) {
  const titleRef = useFocusTitle();

  if (!hasSecret) {
    return (
      <Quiet>
        Set <code className={mono}>VITE_FLIGHT_RULES_SECRET</code> in .env.local
        to view the board.
      </Quiet>
    );
  }
  if (data === undefined) return <Quiet>Connecting…</Quiet>;
  if (data.length === 0) {
    return (
      <Quiet>
        No projects registered yet. Seed one with{" "}
        <code className={mono}>scripts/seed.mjs</code>.
      </Quiet>
    );
  }

  // Stable sort: projects by name.
  const projects = [...data].sort((a, b) =>
    a.project.name.localeCompare(b.project.name),
  );
  const stats = new Map(projects.map((d) => [d.project._id, projectStats(d, now)]));
  const totalFlights = projects.reduce(
    (acc, d) => acc + (stats.get(d.project._id)?.flights.length ?? 0),
    0,
  );
  const quiet = projects.filter((d) => stats.get(d.project._id)?.dormant);

  const lead = `${countNoun(projects.length, "project")}, ${countNoun(totalFlights, "flight")}.`;

  return (
    <section aria-label="All projects">
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="mt-11 max-w-[24em] font-display text-[32px] leading-[1.25] font-normal tracking-[-0.005em] text-balance text-ink outline-none max-[760px]:text-[26px]"
      >
        {lead[0].toUpperCase() + lead.slice(1)}
        {quiet.length > 0 && (
          <>
            {" "}
            <span className="text-warn">
              {quiet.map((d) => d.project.name).join(" and ")}{" "}
              {quiet.length === 1 ? "has" : "have"} gone quiet.
            </span>
          </>
        )}
      </h1>

      <div className="mt-10">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-[650] tracking-[0.02em]">Projects</h2>
        </div>

        <div
          className={`projects-grid projects-grid-head ${microlabel} border-b border-hairline px-4 pb-2`}
          aria-hidden="true"
        >
          <span>Project</span>
          <span>Flights</span>
          <span>Tower</span>
          <span className="col-prs-home">Open PRs</span>
          <span className="text-right">Freshest report</span>
          <span />
        </div>

        {projects.map((d) => (
          <ProjectRow
            key={d.project._id}
            data={d}
            stats={stats.get(d.project._id)!}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}

function ProjectRow({
  data,
  stats,
  now,
}: {
  data: ProjectData;
  stats: ReturnType<typeof projectStats>;
  now: number;
}) {
  const { project, tower } = data;
  const {
    flights,
    listening,
    down,
    stale,
    noReport,
    freshest,
    openPrs,
    draftPrs,
    dormant,
  } = stats;

  const muted = dormant ? "text-ink-3" : "";
  const fleetFrags: Array<ReactNode> = [
    <span key="lede" className={dormant ? "font-semibold" : "font-semibold text-ink"}>
      {flights.length} {flights.length === 1 ? "flight" : "flights"}
    </span>,
  ];
  if (dormant && freshest !== undefined) {
    fleetFrags.push(
      <span key="quiet" className="font-semibold whitespace-nowrap text-warn">
        nothing has reported in {formatAge(now - freshest)}
      </span>,
    );
  } else {
    if (listening > 0)
      fleetFrags.push(
        <span key="l" className="whitespace-nowrap text-good">
          <Fdot tone="good" />
          {listening} listening
        </span>,
      );
    if (down > 0)
      fleetFrags.push(
        <span key="d" className="whitespace-nowrap text-crit">
          <Fdot tone="crit" />
          {down} down
        </span>,
      );
    if (stale > 0)
      fleetFrags.push(
        <span key="s" className="font-semibold whitespace-nowrap text-warn">
          {stale} stale
        </span>,
      );
    if (noReport > 0)
      fleetFrags.push(
        <span key="n" className="whitespace-nowrap text-ink-3">
          <Fdot tone="none" />
          {noReport} no report
        </span>,
      );
  }

  const freshTier =
    freshest === undefined
      ? "never"
      : now - freshest >= 24 * 3_600_000
        ? "stale"
        : now - freshest >= 3_600_000
          ? "aging"
          : "fresh";

  return (
    <Link
      to="/p/$name"
      params={{ name: project.name }}
      className={`projects-grid group min-h-[72px] border-b border-l-[3px] border-hairline py-3.5 pr-4 pl-[13px] text-inherit no-underline hover:no-underline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${
        dormant
          ? "border-l-warn bg-warn-tint hover:bg-warn-tint-hover"
          : "border-l-transparent hover:bg-row-hover"
      }`}
      style={{ viewTransitionName: `project-${project._id}` }}
    >
      <span>
        <span
          className={`font-display text-[21px] leading-[1.15] tracking-[-0.005em] ${dormant ? "text-ink-3" : "text-ink"}`}
        >
          {project.name}
          {dormant && freshest !== undefined && (
            <QuietBadge age={formatAge(now - freshest)} />
          )}
        </span>
        <span className="mt-[3px] block font-mono text-[11.5px] text-ink-3">
          {project.githubRepo}
        </span>
      </span>

      <span className={`min-w-0 text-[13px] tabular-nums ${muted || "text-ink-2"}`}>
        {joinFrags(fleetFrags)}
      </span>

      <span
        className={`min-w-0 text-[12.5px] tabular-nums ${muted || "text-ink-2"}`}
      >
        {tower ? (
          <>
            <span className="block overflow-hidden whitespace-nowrap text-ellipsis">
              <span className={mono}>{tower.branch}</span> ·{" "}
              {tower.dirtyCount === 0 ? (
                "clean"
              ) : (
                <span className="font-semibold text-warn">
                  {tower.dirtyCount} dirty
                </span>
              )}{" "}
              ·{" "}
              {tower.unpushedCount === 0 ? (
                `${tower.unpushedCount} unpushed`
              ) : (
                <span className="font-semibold text-warn">
                  {tower.unpushedCount} unpushed
                </span>
              )}
            </span>
            <TowerVersions
              devVersion={tower.devVersion}
              prodVersion={tower.prodVersion}
            />
          </>
        ) : (
          <span className="text-ink-3 italic">tower has never reported</span>
        )}
      </span>

      <span
        className={`col-prs-home text-[13px] whitespace-nowrap tabular-nums ${muted || "text-ink-2"}`}
      >
        {openPrs === 0 ? (
          <span className="text-ink-3">no open PRs</span>
        ) : (
          `${openPrs} open${draftPrs > 0 ? ` · ${draftPrs} draft` : ""}`
        )}
      </span>

      <span className="text-right text-[12.5px] whitespace-nowrap text-ink-2 tabular-nums">
        {freshest === undefined ? (
          <span className="text-ink-3 italic">never</span>
        ) : freshTier === "stale" ? (
          <span className="font-[650] text-warn">
            {formatAge(now - freshest)} ago
          </span>
        ) : freshTier === "aging" ? (
          <span className="text-warn">{formatAge(now - freshest)} ago</span>
        ) : (
          `${formatAge(now - freshest)} ago`
        )}
      </span>

      <span
        className="text-right text-[15px] text-ink-3 group-hover:text-accent"
        aria-hidden="true"
      >
        →
      </span>
    </Link>
  );
}

function Fdot({ tone }: { tone: "good" | "crit" | "none" }) {
  if (tone === "none") {
    return (
      <span className="mr-[5px] inline-block size-[5px] rounded-full border-[1.5px] border-dashed border-ink-3 align-[1px]" />
    );
  }
  return (
    <span
      className={`mr-[5px] inline-block size-1.5 rounded-full align-[1px] ${tone === "good" ? "bg-good" : "bg-crit"}`}
    />
  );
}

function TowerVersions({
  devVersion,
  prodVersion,
}: {
  devVersion?: string;
  prodVersion?: string;
}) {
  if (!devVersion && !prodVersion) return null;
  return (
    <span className="mt-0.5 block text-xs">
      {devVersion && prodVersion ? (
        devVersion === prodVersion ? (
          <span className="text-ink-3">
            dev and prod in sync (v{devVersion})
          </span>
        ) : (
          <>
            <span className="font-semibold text-warn">prod behind dev</span>{" "}
            <span className="text-ink-3">
              (v{prodVersion} / v{devVersion})
            </span>
          </>
        )
      ) : (
        <span className="text-ink-3">dev v{devVersion ?? prodVersion}</span>
      )}
    </span>
  );
}
