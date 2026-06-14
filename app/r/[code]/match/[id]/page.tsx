import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getMatch,
  getMatchBetBundleForMatch,
} from "@/lib/db/queries";
import { getCustomBetShareMetadata } from "@/lib/share-metadata";
import RoomHeader from "@/components/RoomHeader";
import AutoRefresh from "@/components/AutoRefresh";
import MatchCustomBetsPane from "@/components/MatchCustomBetsPane";
import MatchBetPanel from "@/components/MatchBetPanel";
import MatchScreenLayout from "@/components/MatchScreenLayout";
import TeamFlag from "@/components/TeamFlag";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import { getTeamAbbreviation } from "@/lib/team-flags";
import { translateTeam } from "@/lib/team-i18n";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import LocalDateTime from "@/components/LocalDateTime";
import { createMatchTrace } from "@/lib/dashboard-trace";

export async function generateMetadata(props: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{
    bet?: string | string[] | undefined;
    from?: string | string[] | undefined;
  }>;
}): Promise<Metadata> {
  const { code, id } = await props.params;
  const searchParams = await props.searchParams;
  const betId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;

  if (!betId) return {};

  return (await getCustomBetShareMetadata(code, betId, id)) ?? {};
}

export default async function MatchPage(props: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{
    bet?: string | string[] | undefined;
    from?: string | string[] | undefined;
    tab?: string | string[] | undefined;
  }>;
}) {
  const { code, id } = await props.params;
  const searchParams = await props.searchParams;
  const targetCustomBetId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;
  const preferDashboardBack = Array.isArray(searchParams.from)
    ? searchParams.from[0] === "dashboard"
    : searchParams.from === "dashboard";
  const initialTab =
    (Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab) ===
    "custom"
      ? "custom"
      : "match";
  const trace = createMatchTrace(`/r/${code}/match/${id}`, {
    hasTargetCustomBet: Boolean(targetCustomBetId),
    preferDashboardBack,
  });

  const matchData = await (async () => {
    try {
      const { room, user, dailyGrantApplied } = await trace.step(
        "requireRoomUser",
        () => requireRoomUser(code, { trace }),
        (value) => ({
          roomId: value.room.id,
          userId: value.user.id,
          dailyGrantApplied: value.dailyGrantApplied,
        })
      );

      const [match, matchBetBundle, locale, translations] = await Promise.all([
        trace.step(
          "getMatch",
          () => getMatch(id),
          (value) =>
            value
              ? {
                  matchId: value.id,
                  matchStatus: value.status,
                  hasScoreOdds: Boolean(value.scoreOdds),
                }
              : { matchFound: false }
        ),
        trace.step(
          "getMatchBetBundleForMatch",
          () => getMatchBetBundleForMatch(room.id, user.id, id),
          (value) => ({
            hasMyBet: Boolean(value.myBet),
            matchBetCount: value.allBets.length,
          })
        ),
        trace.step("getLocale", () => getLocale(), (value) => ({ locale: value })),
        trace.step("getTranslations", async () => {
          const [tm, tcomm, tnav] = await Promise.all([
            getTranslations("match"),
            getTranslations("common"),
            getTranslations("nav"),
          ]);
          return { tm, tcomm, tnav };
        }),
      ]);
      if (!match) {
        trace.log("match_not_found", { matchId: id });
        notFound();
      }

      trace.end({
        matchStatus: match.status,
        matchBetCount: matchBetBundle.allBets.length,
        customBetsDeferred: true,
        liveTokenDeferred: true,
      });

      return {
        room,
        user,
        dailyGrantApplied,
        match,
        myBet: matchBetBundle.myBet,
        allBets: matchBetBundle.allBets,
        locale,
        ...translations,
      };
    } catch (error) {
      trace.fail(error);
      throw error;
    }
  })();

  const {
    room,
    user,
    dailyGrantApplied,
    match,
    myBet,
    allBets,
    locale,
    tm,
    tcomm,
    tnav,
  } = matchData;

  const kickoff = new Date(match.kickoff);
  const oddsHome = Number(match.oddsHome ?? 0);
  const oddsDraw = Number(match.oddsDraw ?? 0);
  const oddsAway = Number(match.oddsAway ?? 0);
  const homeTeamAbbreviation = getTeamAbbreviation(match.homeTeam);
  const awayTeamAbbreviation = getTeamAbbreviation(match.awayTeam);
  const homeTeamLocalized = translateTeam(match.homeTeam, locale);
  const awayTeamLocalized = translateTeam(match.awayTeam, locale);
  console.log("matchPage", allBets);

  const matchPane = (
    <>
      <section className="rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_18px_42px_rgba(30,58,138,0.08)]">
        <div className="flex items-center justify-between gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
          <span>{tm("group")} {match.groupLabel}</span>
          <span><LocalDateTime value={kickoff} preset="kickoffLong" /></span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
            <div className="min-w-0 max-w-[7rem] sm:max-w-[12rem]">
              <div className="text-xl font-black leading-tight text-[#1E3A8A] sm:text-2xl">
                <span className="sm:hidden">{homeTeamAbbreviation}</span>
                <span className="hidden break-words sm:inline">
                  {homeTeamLocalized}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {tm("home")}
              </div>
            </div>
            <TeamFlag teamName={match.homeTeam} size={40} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="rounded-full bg-[#F8FBFF] px-4 py-1.5 font-mono text-base font-black tracking-[0.22em] text-[#1E3A8A] ring-1 ring-[#dbe5f2]">
              {match.homeScore != null && match.awayScore != null
                ? `${match.homeScore} : ${match.awayScore}`
                : tm("vs")}
            </span>
            {match.status === "final" ? (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-slate-700">
                {tm("final")}
              </span>
            ) : match.status === "live" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#EA580C]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {tm("live")}
              </span>
            ) : (
              <span className="rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
                {tm("upNext")}
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <TeamFlag teamName={match.awayTeam} size={40} />
            <div className="min-w-0 max-w-[7rem] sm:max-w-[12rem]">
              <div className="text-xl font-black leading-tight text-[#1E3A8A] sm:text-2xl">
                <span className="sm:hidden">{awayTeamAbbreviation}</span>
                <span className="hidden break-words sm:inline">
                  {awayTeamLocalized}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {tm("away")}
              </div>
            </div>
          </div>
        </div>

      </section>

      <MatchBetPanel
        roomCode={room.code}
        matchId={match.id}
        matchStatus={match.status}
        kickoff={new Date(match.kickoff).toISOString()}
        myBet={myBet}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        oddsHome={match.oddsHome != null ? oddsHome : null}
        oddsDraw={match.oddsDraw != null ? oddsDraw : null}
        oddsAway={match.oddsAway != null ? oddsAway : null}
        scoreOdds={match.scoreOdds ?? null}
        maxStake={user.chips}
        defaultDirectionStake={user.defaultDirectionStake}
        defaultScoreStake={user.defaultScoreStake}
      />

      {allBets.length > 0 && (
        <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
          <h2 className="mb-3 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tm("yourBets")}
          </h2>
          <ul className="divide-y divide-[#e7eef8] overflow-hidden rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF]">
            {allBets.map(({ bet, userName }) => (
              <li
                key={bet.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-bold text-[#1E3A8A]">{userName}</span>:{" "}
                  {bet.scoreStake > 0 && (
                    <span className="font-mono font-bold text-slate-700">
                      {bet.predictedHomeScore} – {bet.predictedAwayScore}
                    </span>
                  )}
                </span>
                <span className="font-mono font-semibold text-slate-500">
                  {bet.totalStake} {tcomm("chips")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  const customBetsPane = (
    <MatchCustomBetsPane
      roomCode={room.code}
      matchId={match.id}
      matchStatus={match.status}
      matchLabel={`${homeTeamLocalized} ${tm("vs")} ${awayTeamLocalized}`}
      matchKickoff={new Date(match.kickoff).toISOString()}
      viewerUserId={user.id}
      myChips={user.chips}
      targetCustomBetId={targetCustomBetId}
      requestKey={trace.id}
    />
  );

  return (
    <>
      <RoomHeader room={room} user={user} />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <AutoRefresh
        traceLabel="match"
        pollUrl={`/api/live/room/${encodeURIComponent(room.code)}/match/${encodeURIComponent(match.id)}`}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={`${homeTeamLocalized} ${tm("vs")} ${awayTeamLocalized}`}
          preferBack={preferDashboardBack}
        />
        <MatchScreenLayout
          matchPane={matchPane}
          customBetsPane={customBetsPane}
          initialTab={initialTab}
          targetCustomBetId={targetCustomBetId}
        />
      </main>
    </>
  );
}
