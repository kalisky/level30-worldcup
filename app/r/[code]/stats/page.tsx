import { getLocale, getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getRoomStats,
  type RoomStatsContinentEntry,
  type RoomStatsMatchEntry,
  type RoomStatsPayoutMatchEntry,
  type RoomStatsPlayerPayoutEntry,
  type RoomStatsUserEntry,
} from "@/lib/db/queries";
import { translateTeam } from "@/lib/team-i18n";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import DailyGrantBanner from "@/components/DailyGrantBanner";

const podiumClasses = [
  "border-[#FDE68A] bg-[#FFF9DB]",
  "border-slate-200 bg-slate-100",
  "border-[#FED7AA] bg-[#FFF1E8]",
];
const MAX_STATS_ROWS = 10;

function topRows<T>(rows: T[]): T[] {
  return rows.slice(0, MAX_STATS_ROWS);
}

export default async function StatsPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string | string[] | undefined }>;
}) {
  const { code } = await props.params;
  const searchParams = await props.searchParams;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);
  const preferDashboardBack = Array.isArray(searchParams.from)
    ? searchParams.from[0] === "dashboard"
    : searchParams.from === "dashboard";

  const locale = await getLocale();
  const percentFormatter = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const integerFormatter = new Intl.NumberFormat(locale);
  const [stats, tnav, tstats, tc, tm] = await Promise.all([
    getRoomStats(room.id),
    getTranslations("nav"),
    getTranslations("stats"),
    getTranslations("common"),
    getTranslations("match"),
  ]);

  return (
    <>
      <RoomHeader room={room} user={user} active="stats" />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 space-y-6">
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={tnav("stats")}
          preferBack={preferDashboardBack}
        />

        <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tnav("stats")}
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#1E3A8A]">
            {room.name}
          </h1>
          <p className="mt-3 text-sm text-slate-500">{tstats("subtitle")}</p>
          <p className="mt-4 inline-flex rounded-full bg-[#F8FBFF] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            {tstats("settledBetCount", { count: stats.settledBetCount })}
          </p>
        </section>

        {stats.settledBetCount === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[#dbe5f2] bg-white p-8 text-center shadow-[0_16px_38px_rgba(30,58,138,0.05)]">
            <p className="text-base font-semibold text-slate-600">
              {tstats("noSettledBets")}
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            <StatsUserSection
              title={tstats("directionHitsTitle")}
              rows={topRows(stats.directionHitsByUser)}
              currentUserId={user.id}
              currentUserLabel={tc("you")}
            />
            <StatsUserSection
              title={tstats("exactScoreHitsTitle")}
              rows={topRows(stats.exactScoreHitsByUser)}
              currentUserId={user.id}
              currentUserLabel={tc("you")}
            />
            <StatsUserSection
              title={tstats("oneTeamExactHitsTitle")}
              rows={topRows(stats.oneTeamExactHitsByUser)}
              currentUserId={user.id}
              currentUserLabel={tc("you")}
            />
            <StatsUserSection
              title={tstats("oneGoalShortExactHitsTitle")}
              rows={topRows(stats.oneGoalShortExactHitsByUser)}
              currentUserId={user.id}
              currentUserLabel={tc("you")}
            />
            <StatsContinentSection
              title={tstats("directionHitPctByContinentTitle")}
              rows={topRows(stats.directionHitPctByContinent)}
              percentFormatter={percentFormatter}
              integerFormatter={integerFormatter}
              emptyLabel={tstats("noDirectionPctByContinent")}
              continentLabel={(confederation) =>
                tstats(`continents.${confederation}`)
              }
            />
            <StatsMatchSection
              title={tstats("directionMissesByMatchTitle")}
              rows={topRows(stats.directionMissesByMatch)}
              locale={locale}
              emptyLabel={tstats("noDirectionMisses")}
              finalLabel={tm("final")}
              versusLabel={tm("vs")}
              valueFormatter={(row) => integerFormatter.format(row.count)}
            />
            <StatsMatchSection
              title={tstats("exactScoreHitsByMatchTitle")}
              rows={topRows(stats.exactScoreHitsByMatch)}
              locale={locale}
              emptyLabel={tstats("noExactScoreHits")}
              finalLabel={tm("final")}
              versusLabel={tm("vs")}
              valueFormatter={(row) => integerFormatter.format(row.count)}
            />
            <StatsPayoutSection
              title={tstats("biggestPayoutMatchesTitle")}
              rows={topRows(stats.biggestPayoutMatches)}
              locale={locale}
              emptyLabel={tstats("noPayoutMatches")}
              finalLabel={tm("final")}
              versusLabel={tm("vs")}
              valueSuffix={tc("chips")}
              integerFormatter={integerFormatter}
            />
            <StatsSinglePlayerPayoutSection
              title={tstats("biggestSinglePlayerPayoutsTitle")}
              rows={topRows(stats.biggestSinglePlayerPayouts)}
              locale={locale}
              emptyLabel={tstats("noSinglePlayerPayouts")}
              finalLabel={tm("final")}
              versusLabel={tm("vs")}
              valueSuffix={tc("chips")}
              integerFormatter={integerFormatter}
              currentUserId={user.id}
              currentUserLabel={tc("you")}
            />
          </div>
        )}
      </main>
    </>
  );
}

function StatsUserSection({
  title,
  rows,
  currentUserId,
  currentUserLabel,
}: {
  title: string;
  rows: RoomStatsUserEntry[];
  currentUserId: string;
  currentUserLabel: string;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </h2>
      <ol className="mt-4 space-y-2">
        {rows.map((row, index) => {
          const highlightClass =
            index < 3
              ? podiumClasses[index]
              : row.id === currentUserId
                ? "border-[#BFDBFE] bg-[#EFF6FF]"
                : "border-[#e4edf7] bg-[#F8FBFF]";

          return (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3 ${highlightClass}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black " +
                    (index === 0
                      ? "bg-[#FDE68A] text-[#92400E]"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-[#FED7AA] text-[#9A3412]"
                          : row.id === currentUserId
                            ? "bg-[#DBEAFE] text-[#1D4ED8]"
                            : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1E3A8A]">
                    {row.name}
                  </p>
                  {row.id === currentUserId && (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">
                      {currentUserLabel}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 font-mono text-2xl font-black text-[#1E3A8A]">
                {row.count}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StatsContinentSection({
  title,
  rows,
  percentFormatter,
  integerFormatter,
  emptyLabel,
  continentLabel,
}: {
  title: string;
  rows: RoomStatsContinentEntry[];
  percentFormatter: Intl.NumberFormat;
  integerFormatter: Intl.NumberFormat;
  emptyLabel: string;
  continentLabel: (confederation: RoomStatsContinentEntry["confederation"]) => string;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.confederation}
              className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3 ${
                index < 3
                  ? podiumClasses[index]
                  : "border-[#e4edf7] bg-[#F8FBFF]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black " +
                    (index === 0
                      ? "bg-[#FDE68A] text-[#92400E]"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-[#FED7AA] text-[#9A3412]"
                          : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1E3A8A]">
                    {continentLabel(row.confederation)}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {integerFormatter.format(row.hits)}/
                    {integerFormatter.format(row.attempts)}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-2xl font-black text-[#1E3A8A]">
                {percentFormatter.format(row.pct)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StatsMatchSection({
  title,
  rows,
  locale,
  emptyLabel,
  finalLabel,
  versusLabel,
  valueFormatter,
}: {
  title: string;
  rows: RoomStatsMatchEntry[];
  locale: string;
  emptyLabel: string;
  finalLabel: string;
  versusLabel: string;
  valueFormatter: (row: RoomStatsMatchEntry) => string;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3 ${
                index < 3
                  ? podiumClasses[index]
                  : "border-[#e4edf7] bg-[#F8FBFF]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black " +
                    (index === 0
                      ? "bg-[#FDE68A] text-[#92400E]"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-[#FED7AA] text-[#9A3412]"
                          : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1E3A8A]">
                    {translateTeam(row.homeTeam, locale)}{" "}
                    <span className="text-slate-400">{versusLabel}</span>{" "}
                    {translateTeam(row.awayTeam, locale)}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {finalLabel} {row.homeScore}–{row.awayScore}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-2xl font-black text-[#1E3A8A]">
                {valueFormatter(row)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StatsPayoutSection({
  title,
  rows,
  locale,
  emptyLabel,
  finalLabel,
  versusLabel,
  valueSuffix,
  integerFormatter,
}: {
  title: string;
  rows: RoomStatsPayoutMatchEntry[];
  locale: string;
  emptyLabel: string;
  finalLabel: string;
  versusLabel: string;
  valueSuffix: string;
  integerFormatter: Intl.NumberFormat;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3 ${
                index < 3
                  ? podiumClasses[index]
                  : "border-[#e4edf7] bg-[#F8FBFF]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black " +
                    (index === 0
                      ? "bg-[#FDE68A] text-[#92400E]"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-[#FED7AA] text-[#9A3412]"
                          : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1E3A8A]">
                    {translateTeam(row.homeTeam, locale)}{" "}
                    <span className="text-slate-400">{versusLabel}</span>{" "}
                    {translateTeam(row.awayTeam, locale)}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {finalLabel} {row.homeScore}–{row.awayScore}
                  </p>
                </div>
              </div>
              <span className="text-right">
                <span className="block shrink-0 font-mono text-2xl font-black text-[#1E3A8A]">
                  {integerFormatter.format(row.totalPayout)}
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {valueSuffix}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StatsSinglePlayerPayoutSection({
  title,
  rows,
  locale,
  emptyLabel,
  finalLabel,
  versusLabel,
  valueSuffix,
  integerFormatter,
  currentUserId,
  currentUserLabel,
}: {
  title: string;
  rows: RoomStatsPlayerPayoutEntry[];
  locale: string;
  emptyLabel: string;
  finalLabel: string;
  versusLabel: string;
  valueSuffix: string;
  integerFormatter: Intl.NumberFormat;
  currentUserId: string;
  currentUserLabel: string;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-3 ${
                index < 3
                  ? podiumClasses[index]
                  : row.userId === currentUserId
                    ? "border-[#BFDBFE] bg-[#EFF6FF]"
                    : "border-[#e4edf7] bg-[#F8FBFF]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black " +
                    (index === 0
                      ? "bg-[#FDE68A] text-[#92400E]"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-[#FED7AA] text-[#9A3412]"
                          : row.userId === currentUserId
                            ? "bg-[#DBEAFE] text-[#1D4ED8]"
                            : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                  }
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1E3A8A]">
                    {row.userName}
                  </p>
                  {row.userId === currentUserId && (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">
                      {currentUserLabel}
                    </p>
                  )}
                  <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {translateTeam(row.homeTeam, locale)} {versusLabel}{" "}
                    {translateTeam(row.awayTeam, locale)}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {finalLabel} {row.homeScore}–{row.awayScore}
                  </p>
                </div>
              </div>
              <span className="text-right">
                <span className="block shrink-0 font-mono text-2xl font-black text-[#1E3A8A]">
                  {integerFormatter.format(row.payout)}
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {valueSuffix}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
