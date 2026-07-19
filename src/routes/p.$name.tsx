import { Link, createFileRoute } from "@tanstack/react-router";

import {
  AgingBadge,
  Dot,
  ExtLink,
  Masthead,
  SilentBadge,
  StaleBadge,
  branchUrl,
  deploymentUrl,
  formatAge,
  hasSecret,
  joinFrags,
  microlabel,
  mono,
  portUrl,
  prUrl,
  projectStats,
  reportTier,
  repoUrl,
  useBoard,
  useFocusTitle,
  useMounted,
  useNow,
  useRowTransitions,
} from "../lib/board";

import type { Flight, Pr, Project, ProjectData } from "../lib/board";
import type { ReactNode } from "react";

export const Route = createFileRoute("/p/$name")({
  head: ({ params }) => ({
    meta: [{ title: `Flight Rules — ${params.name}` }],
  }),
  component: BoardPage,
});

function boardKey(data: ProjectData) {
  return data.flights
    .filter((f) => f.status === "airborne")
    .map((f) => f._id)
    .sort()
    .join();
}

function BoardPage() {
  const { name } = Route.useParams();
  const mounted = useMounted();
  const now = useNow();
  const raw = useBoard();
  const entry = raw?.find((d) => d.project.name === name);
  const data = useRowTransitions(mounted ? entry : undefined, boardKey);

  return (
    <div className="mx-auto max-w-[1360px] px-8 pb-[72px]">
      <Masthead data={mounted ? raw : undefined} now={now} />
      <Link to="/" className="mt-[22px] inline-block text-[12.5px]">
        ← All projects
      </Link>
      {!mounted || raw === undefined ? (
        hasSecret || !mounted ? (
          <Quiet>Connecting…</Quiet>
        ) : (
          <Quiet>
            Set <code className={mono}>VITE_FLIGHT_RULES_SECRET</code> in
            .env.local to view the board.
          </Quiet>
        )
      ) : data === undefined ? (
        <Quiet>
          No project named <code className={mono}>{name}</code> is registered.
        </Quiet>
      ) : (
        <Board data={data} now={now} />
      )}
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-[13px] text-ink-3">{children}</p>;
}

function Board({ data, now }: { data: ProjectData; now: number }) {
  const titleRef = useFocusTitle();
  const { project, tower, looseEnds, events } = data;
  const stats = projectStats(data, now);
  const { flights, listening, down, stale, noReport, freshest, openPrs, draftPrs, dormant } =
    stats;

  const summaryFrags: Array<ReactNode> = [
    <span key="f">
      {flights.length} {flights.length === 1 ? "flight" : "flights"}
    </span>,
  ];
  if (listening > 0) summaryFrags.push(<span key="l">{listening} listening</span>);
  if (down > 0) summaryFrags.push(<span key="d">{down} down</span>);
  if (dormant) {
    summaryFrags.push(
      <span key="q" className="font-semibold text-warn">
        everything stale
      </span>,
    );
  } else {
    if (stale > 0)
      summaryFrags.push(
        <span key="s" className="font-semibold text-warn">
          {stale} stale
        </span>,
      );
    if (noReport > 0)
      summaryFrags.push(
        <span key="n" className="font-semibold text-warn">
          {noReport} never reported
        </span>,
      );
  }
  summaryFrags.push(
    <span key="pr">
      {openPrs === 0
        ? "no open PRs"
        : `${openPrs} ${openPrs === 1 ? "PR" : "PRs"}${draftPrs > 0 ? ` (${draftPrs} draft)` : ""}`}
    </span>,
  );

  return (
    <section
      aria-label={`${project.name} board`}
      className={dormant ? "board-dormant" : undefined}
    >
      <div className="mt-2.5 flex flex-wrap items-baseline gap-4">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="font-display text-[30px] leading-[1.15] font-normal tracking-[-0.005em] text-ink outline-none"
        >
          {project.name}
        </h1>
        <ExtLink href={repoUrl(project)} className="font-mono text-[12.5px]">
          {project.githubRepo}
        </ExtLink>
        <p className="ml-auto text-[13px] text-ink-2 tabular-nums max-[960px]:ml-0 max-[960px]:w-full">
          {joinFrags(summaryFrags)}
        </p>
      </div>

      {dormant && freshest !== undefined && (
        <div
          className="mt-[18px] flex flex-wrap items-baseline gap-2.5 rounded-md border border-warn-line bg-warn-bg px-[18px] py-[11px] text-[13px] text-warn"
          role="status"
        >
          <strong className="font-bold tracking-[0.02em] uppercase">
            Project quiet
          </strong>
          <span className="font-normal text-warn-ink">
            Nothing on this project has reported in{" "}
            {formatAge(now - freshest)}. Everything below is what was last
            observed — it may no longer be true.
          </span>
        </div>
      )}

      <TowerBand project={project} tower={tower} now={now} dormant={dormant} />

      <section className="mt-7" aria-label="Flights">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-[650] tracking-[0.02em]">Flights</h2>
        </div>

        <div
          className={`flight-grid flight-grid-head ${microlabel} border-b border-hairline px-4 pb-2`}
          aria-hidden="true"
        >
          <span />
          <span>Flight</span>
          <span>Branch · Position</span>
          <span>Env</span>
          <span className="col-pr">PR</span>
          <span className="text-right">Reported</span>
        </div>

        {flights.length === 0 ? (
          <p className="py-2.5 text-[13px] text-ink-3 italic">
            No flights airborne.
          </p>
        ) : (
          flights.map((f) => (
            <FlightRow
              key={f._id}
              project={project}
              flight={f}
              prs={data.prs}
              now={now}
            />
          ))
        )}
      </section>

      <div className="lower-grid mt-10 border-t border-hairline pt-6">
        <section aria-label="Loose ends">
          <h2 className={`${microlabel} mb-3`}>
            Loose ends
            <span className="ml-1.5 font-normal tabular-nums">
              {looseEnds.length}
            </span>
          </h2>
          {looseEnds.length === 0 ? (
            <p className="py-[9px] text-[13px] text-ink-3 italic">
              No loose ends on this project.
            </p>
          ) : (
            <ul>
              {looseEnds.map((l) => (
                <li
                  key={l._id}
                  className="flex items-baseline gap-2.5 border-b border-hairline py-[9px] text-[13px] first:border-t"
                >
                  <span
                    className="relative -top-px size-1.5 flex-none rounded-full bg-warn"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <span className="flex-none text-[11.5px] whitespace-nowrap text-ink-3 tabular-nums">
                    {l.source} · {formatAge(now - l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Activity">
          <h2 className={`${microlabel} mb-3`}>Activity</h2>
          {events.length === 0 ? (
            <p className="py-[9px] text-[13px] text-ink-3 italic">
              Nothing yet.
            </p>
          ) : (
            <ul>
              {events.map((e) => (
                <li
                  key={e._id}
                  className="flex items-baseline gap-3 border-b border-hairline py-[7px] text-[13px] first:border-t"
                >
                  <span
                    className={`w-[78px] flex-none text-[10.5px] font-[650] tracking-[0.06em] uppercase ${
                      EVENT_META[e.kind]?.cls ?? "text-ink-2"
                    }`}
                  >
                    {EVENT_META[e.kind]?.label ?? e.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    <EventText project={project} kind={e.kind} payload={e.payload} />
                  </span>
                  <span className="w-[34px] flex-none text-right text-[11.5px] text-ink-3 tabular-nums">
                    {formatAge(now - e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

// --- tower band ---------------------------------------------------------------

function TowerBand({
  project,
  tower,
  now,
  dormant,
}: {
  project: Project;
  tower: ProjectData["tower"];
  now: number;
  dormant: boolean;
}) {
  const towerAge = tower ? now - tower.reportedAt : undefined;
  return (
    <section
      className={`tower-band mt-5 flex flex-wrap items-center gap-10 rounded-md border px-5 pt-3.5 pb-[15px] max-[960px]:gap-6 ${
        dormant ? "border-warn-line bg-warn-bg" : "border-hairline bg-panel"
      }`}
      aria-label="Tower status"
    >
      <div className="flex min-w-[118px] items-center gap-2.5">
        <span className={`${microlabel} text-ink-2`}>Tower</span>
        {tower && (
          <ExtLink href={branchUrl(project, tower.branch)} className={mono}>
            {tower.branch}
          </ExtLink>
        )}
      </div>
      {tower ? (
        <>
          <dl className="m-0 flex flex-wrap gap-10">
            <div>
              <dt className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-3">
                Worktree
              </dt>
              <dd className="text-[13px] tabular-nums">
                {tower.dirtyCount === 0 ? (
                  <span className="text-[11.5px] text-ink-3">clean</span>
                ) : (
                  <span className="text-[11.5px] font-semibold text-warn">
                    {tower.dirtyCount} dirty{" "}
                    {tower.dirtyCount === 1 ? "file" : "files"}
                  </span>
                )}{" "}
                ·{" "}
                <span
                  className={
                    tower.unpushedCount > 0
                      ? "text-[11.5px] font-semibold text-warn"
                      : undefined
                  }
                >
                  {tower.unpushedCount} unpushed
                </span>
              </dd>
            </div>
            {tower.devVersion && (
              <div>
                <dt className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-3">
                  Dev
                </dt>
                <dd className={`text-[13px] tabular-nums ${mono}`}>
                  v{tower.devVersion}
                </dd>
              </div>
            )}
            {tower.prodVersion && (
              <div>
                <dt className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-3">
                  Prod
                </dt>
                <dd className={`text-[13px] tabular-nums ${mono}`}>
                  {project.prodUrl ? (
                    <ExtLink href={project.prodUrl}>
                      v{tower.prodVersion}
                    </ExtLink>
                  ) : (
                    <>v{tower.prodVersion}</>
                  )}
                </dd>
              </div>
            )}
            {tower.devVersion && tower.prodVersion && (
              <div>
                <dt className="mb-0.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-3">
                  Version drift
                </dt>
                <dd className="text-[13px] tabular-nums">
                  {tower.devVersion === tower.prodVersion ? (
                    <span className="text-xs text-ink-3">
                      dev and prod in sync
                    </span>
                  ) : (
                    <span className="rounded border border-warn-line bg-warn-bg px-2 py-0.5 text-xs whitespace-nowrap text-warn">
                      prod is behind dev
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          <span
            className={`ml-auto text-xs whitespace-nowrap tabular-nums max-[960px]:ml-0 ${
              dormant ? "font-semibold text-warn" : "text-ink-2"
            }`}
          >
            {dormant ? (
              <>last reported {formatAge(towerAge!)} ago</>
            ) : (
              <>
                {towerAge! < 10 * 60_000 && (
                  <span className="text-good">● </span>
                )}
                reported {formatAge(towerAge!)} ago
              </>
            )}
          </span>
        </>
      ) : (
        <span className="text-xs text-ink-3 italic">
          never reported — run the reporter to populate
        </span>
      )}
    </section>
  );
}

// --- flight rows --------------------------------------------------------------

function FlightRow({
  project,
  flight,
  prs,
  now,
}: {
  project: Project;
  flight: Flight;
  prs: Array<Pr>;
  now: number;
}) {
  const report = flight.report;
  const tier = reportTier(report?.reportedAt, now);
  const pr =
    prs.find((p) => p.number === report?.prNumber) ??
    prs.find((p) => p.headRef === flight.branch);

  const rowTone =
    tier === "stale"
      ? "border-l-warn bg-warn-tint hover:bg-warn-tint-hover"
      : tier === "never"
        ? "border-l-hairline bg-silent-tint hover:bg-silent-tint-hover"
        : "border-l-transparent hover:bg-row-hover";
  const silentMuted = tier === "never" ? "text-ink-3" : "";

  const status = !report
    ? {
        cls: "text-ink-3 font-[550]",
        dot: "none" as const,
        label: "NO REPORT",
        title: "No report received yet",
      }
    : report.listening === true
      ? {
          cls: "text-good font-[650]",
          dot: "good" as const,
          label: "LISTENING",
          title: "Listening on its port",
        }
      : report.listening === false
        ? {
            cls: "text-crit font-[650]",
            dot: "crit" as const,
            label: "NOT LISTENING",
            title: "Not listening — nothing answering on its port",
          }
        : {
            cls: "text-ink-3 font-[550]",
            dot: "none" as const,
            label: "NO PORT",
            title: "Reporting, but no port assigned",
          };

  const aliveProcs = report
    ? Object.entries(report.processes)
        .filter(([, alive]) => alive)
        .map(([name]) => name)
    : [];

  return (
    <article
      className={`flight-grid min-h-14 border-b border-l-[3px] border-hairline py-[11px] pr-4 pl-[13px] ${rowTone}`}
      style={{ viewTransitionName: `flight-${flight._id}` }}
    >
      <span
        className={`inline-flex items-center text-[11px] tracking-[0.06em] whitespace-nowrap ${status.cls}`}
        title={status.title}
      >
        <Dot tone={status.dot} />
        {/* Dot-only on desktop (title carries the detail); label returns in the
            stacked mobile layout where hover doesn't exist. */}
        <span className="sr-only max-[760px]:not-sr-only">{status.label}</span>
      </span>

      <span
        className="min-w-0 text-[13.5px] font-semibold tracking-[-0.005em]"
        title={flight.slug}
      >
        <span className="line-clamp-2 break-all">{flight.slug}</span>
      </span>

      <span className="min-w-0 text-[12.5px]">
        <ExtLink
          href={branchUrl(project, flight.branch)}
          className={`${mono} block overflow-hidden whitespace-nowrap text-ellipsis`}
        >
          {flight.branch}
        </ExtLink>
        {report ? (
          <span
            className={`mt-0.5 block text-xs tabular-nums ${silentMuted || "text-ink-2"}`}
          >
            ↑{report.ahead}{" "}
            <span
              className={
                report.behind >= 10 ? "font-semibold text-warn" : undefined
              }
            >
              ↓{report.behind}
            </span>{" "}
            ·{" "}
            {report.dirtyCount === 0 ? (
              <span className="text-[11.5px] text-ink-3">clean</span>
            ) : (
              <span className="text-[11.5px] font-semibold text-warn">
                {report.dirtyCount} dirty{" "}
                {report.dirtyCount === 1 ? "file" : "files"}
              </span>
            )}
          </span>
        ) : (
          <span className="mt-0.5 block text-xs text-ink-3 italic">
            position unknown
          </span>
        )}
      </span>

      <span className={`min-w-0 text-[12.5px] ${silentMuted}`}>
        <span className="block truncate">
          {flight.port !== undefined && (
            <ExtLink href={portUrl(project, flight.port)} className={mono}>
              :{flight.port}
            </ExtLink>
          )}
          {flight.port !== undefined && flight.deploymentName && (
            <span className="mx-1.5 text-ink-3">·</span>
          )}
          {flight.deploymentName && (
            <ExtLink
              href={deploymentUrl(project, flight.deploymentName)}
              className={mono}
              title={flight.deploymentName}
            >
              {flight.deploymentName}
            </ExtLink>
          )}
        </span>
        {aliveProcs.length > 0 && (
          <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
            {aliveProcs.join(" · ")}
          </span>
        )}
      </span>

      <span className="col-pr min-w-0 text-[12.5px]">
        {pr ? (
          <>
            <ExtLink href={prUrl(project, pr.number)} className={mono}>
              #{pr.number}
            </ExtLink>
            <PrState pr={pr} />
            <span className="mt-px block truncate text-xs text-ink-2">
              {pr.title}
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-3">no PR</span>
        )}
      </span>

      <span className="text-right text-[12.5px] whitespace-nowrap text-ink-2 tabular-nums">
        {!report ? (
          <>
            <span className="text-ink-3 italic">never</span>
            <BadgeSlot>
              <SilentBadge />
            </BadgeSlot>
          </>
        ) : tier === "stale" ? (
          <>
            <span className="font-[650] text-warn">
              {formatAge(now - report.reportedAt)} ago
            </span>
            <BadgeSlot>
              <StaleBadge />
            </BadgeSlot>
          </>
        ) : tier === "aging" ? (
          <>
            <span className="text-warn">
              {formatAge(now - report.reportedAt)} ago
            </span>
            <BadgeSlot>
              <AgingBadge />
            </BadgeSlot>
          </>
        ) : (
          <>{formatAge(now - report.reportedAt)} ago</>
        )}
      </span>
    </article>
  );
}

// Badges stack under the age so nothing overflows the column.
function BadgeSlot({ children }: { children: ReactNode }) {
  return (
    <span className="mt-[3px] ml-auto block w-max max-[760px]:ml-0">
      {children}
    </span>
  );
}

function PrState({ pr }: { pr: Pr }) {
  const label = pr.isDraft
    ? "draft"
    : pr.state === "OPEN"
      ? "open"
      : pr.state.toLowerCase();
  const cls =
    label === "open"
      ? "text-good bg-good-bg"
      : "text-ink-2 bg-chip";
  return (
    <span
      className={`ml-1.5 inline-block rounded-[3px] px-[5px] align-[1px] text-[10.5px] font-[650] tracking-[0.06em] uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

// --- activity -----------------------------------------------------------------

const EVENT_META: Record<string, { label: string; cls: string }> = {
  takeoff: { label: "Takeoff", cls: "text-accent" },
  landing: { label: "Landing", cls: "text-good" },
  scrub: { label: "Scrub", cls: "text-ink-3" },
  "pr-opened": { label: "PR opened", cls: "text-ink-2" },
  release: { label: "Release", cls: "text-warn" },
};

function EventText({
  project,
  kind,
  payload,
}: {
  project: Project;
  kind: string;
  // events.payload is v.any() in the schema; render defensively.
  payload: Record<string, unknown> | null | undefined;
}) {
  const p = payload ?? {};
  const slug = typeof p.slug === "string" ? p.slug : undefined;
  const branch = typeof p.branch === "string" ? p.branch : undefined;
  const number = typeof p.number === "number" ? p.number : undefined;
  const title = typeof p.title === "string" ? p.title : undefined;
  const version = typeof p.version === "string" ? p.version : undefined;
  const reason = typeof p.reason === "string" ? p.reason : undefined;

  switch (kind) {
    case "scrub":
      return (
        <>
          {slug && <b className="font-semibold text-ink">{slug}</b>}
          {slug && (reason ?? branch) && " · "}
          {reason ??
            (branch && (
              <ExtLink href={branchUrl(project, branch)} className={mono}>
                {branch}
              </ExtLink>
            ))}
        </>
      );
    case "takeoff":
    case "landing":
      return (
        <>
          {slug && <b className="font-semibold text-ink">{slug}</b>}
          {slug && (branch || number) && " · "}
          {branch && (
            <ExtLink href={branchUrl(project, branch)} className={mono}>
              {branch}
            </ExtLink>
          )}
          {branch && number && " · "}
          {number && (
            <ExtLink href={prUrl(project, number)} className={mono}>
              #{number}
            </ExtLink>
          )}
          {kind === "landing" && number && " merged"}
        </>
      );
    case "pr-opened":
      return (
        <>
          {number && (
            <ExtLink href={prUrl(project, number)} className={mono}>
              #{number}
            </ExtLink>
          )}
          {title && <> — {title}</>}
        </>
      );
    case "release":
      return (
        <>
          {version && <span className={mono}>{version}</span>}
          {version && branch && " cut from "}
          {branch && <span className={mono}>{branch}</span>}
        </>
      );
    default:
      return <>{JSON.stringify(p).slice(0, 80)}</>;
  }
}
