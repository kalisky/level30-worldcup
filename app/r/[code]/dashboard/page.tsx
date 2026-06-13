import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import {
  countOpenCustomBetsByMatch,
  getMyMatchBets,
  hydrateCustomBetRowsWithWagers,
  listOpenCustomBets,
  listAllMatches,
} from "@/lib/db/queries";
import { getCustomBetShareMetadata } from "@/lib/share-metadata";
import RoomHeader from "@/components/RoomHeader";
import AutoRefresh from "@/components/AutoRefresh";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";
import MatchScreenLayout from "@/components/MatchScreenLayout";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import DashboardMatchGroups from "@/components/DashboardMatchGroups";
import StickyDashboardHeader from "@/components/StickyDashboardHeader";
import type { DashboardTrace } from "@/lib/dashboard-trace";
import { createDashboardTrace } from "@/lib/dashboard-trace";

export async function generateMetadata(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ bet?: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { code } = await props.params;
  const searchParams = await props.searchParams;
  const betId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;

  if (!betId) return {};

  return (await getCustomBetShareMetadata(code, betId)) ?? {};
}

export default async function DashboardPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    bet?: string | string[] | undefined;
    created?: string | string[] | undefined;
  }>;
}) {
  const { code } = await props.params;
  const searchParams = await props.searchParams;
  const targetCustomBetId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;
  const roomWasCreated = Array.isArray(searchParams.created)
    ? searchParams.created[0] === "1"
    : searchParams.created === "1";
  const trace = createDashboardTrace(`/r/${code}/dashboard`, {
    hasTargetCustomBet: Boolean(targetCustomBetId),
    roomWasCreated,
  });

  const dashboardData = await (async () => {
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
      const [t, tnav] = await Promise.all([
        trace.step("getTranslations", () => getTranslations("dashboard")),
        getTranslations("nav"),
      ]);

      trace.end({
        upcomingDeferred: true,
        customBetsDeferred: true,
        liveTokenDeferred: true,
      });

      return {
        room,
        user,
        dailyGrantApplied,
        t,
        tnav,
      };
    } catch (error) {
      trace.fail(error);
      throw error;
    }
  })();

  const { room, user, dailyGrantApplied, t, tnav } = dashboardData;

  const mobileDashboardHeader = (
    <StickyDashboardHeader
      roomName={room.name}
      roomCode={room.code}
      historyLabel={tnav("history")}
      leaderboardLabel={tnav("leaderboard")}
    />
  );

  const dashboardPane = (
    <>
      <Suspense
        fallback={
          <DashboardMatchesPaneSkeleton heading={t("upcomingMatches")} />
        }
      >
        <DashboardMatchesPane
          trace={trace}
          roomId={room.id}
          roomCode={room.code}
          userId={user.id}
          myChips={user.chips}
          defaultDirectionStake={user.defaultDirectionStake}
          defaultScoreStake={user.defaultScoreStake}
          heading={t("upcomingMatches")}
          emptyLabel={t("noMatches")}
        />
      </Suspense>
    </>
  );

  const customBetsPane = (
    <Suspense fallback={<DashboardCustomBetsPaneSkeleton heading={t("customBets")} />}>
      <DashboardCustomBetsPane
        trace={trace}
        roomId={room.id}
        roomCode={room.code}
        userId={user.id}
        myChips={user.chips}
        heading={t("customBets")}
        emptyLabel={t("noCustomBets")}
        targetCustomBetId={targetCustomBetId}
      />
    </Suspense>
  );

  return (
    <>
      <RoomHeader
        room={room}
        user={user}
        active="dashboard"
        initialRoomModalOpen={roomWasCreated}
      />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <AutoRefresh
        traceLabel="dashboard"
        liveToken={null}
        pollUrl={`/api/live/room/${encodeURIComponent(room.code)}/dashboard`}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {mobileDashboardHeader}
        <section className="mb-6 hidden lg:block">
          <div className="flex items-center justify-between gap-4 pb-5">
            <h1 className="min-w-0 truncate text-[2rem] font-black text-[#1E3A8A]">
              {room.name}
            </h1>
            <nav className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href={`/r/${room.code}/history?from=dashboard`}
                className="rounded-full border border-[#d7deea] bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[#c3cedd] hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
              >
                {tnav("history")}
              </Link>
              <Link
                href={`/r/${room.code}/leaderboard?from=dashboard`}
                className="rounded-full border border-[#d7deea] bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[#c3cedd] hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
              >
                {tnav("leaderboard")}
              </Link>
            </nav>
          </div>
          <div className="h-px w-full bg-[#dbe5f2]" aria-hidden="true" />
        </section>
        <MatchScreenLayout
          matchPane={dashboardPane}
          customBetsPane={customBetsPane}
          matchTabLabel="Dashboard"
          customBetsTabLabel="Custom Bets"
          targetCustomBetId={targetCustomBetId}
        />
      </main>
    </>
  );
}

async function DashboardMatchesPane({
  trace,
  roomId,
  roomCode,
  userId,
  myChips,
  defaultDirectionStake,
  defaultScoreStake,
  heading,
  emptyLabel,
}: {
  trace: DashboardTrace;
  roomId: string;
  roomCode: string;
  userId: string;
  myChips: number;
  defaultDirectionStake: number | null;
  defaultScoreStake: number | null;
  heading: string;
  emptyLabel: string;
}) {
  const [upcoming, myBets, customBetCounts] = await Promise.all([
    trace.step("listAllMatches", () => listAllMatches(), (rows) => ({
      matchCount: rows.length,
    })),
    trace.step("getMyMatchBets", () => getMyMatchBets(roomId, userId), (rows) => ({
      myBetCount: rows.length,
    })),
    trace.step(
      "countOpenCustomBetsByMatch",
      () => countOpenCustomBetsByMatch(roomId),
      (rows) => ({
        matchesWithCustomBets: Object.keys(rows).length,
      })
    ),
  ]);

  const myBetByMatch = Object.fromEntries(
    myBets.map((bet) => [
      bet.matchId,
      {
        directionPick: bet.directionPick,
        directionStake: bet.directionStake,
        directionOddsLocked: Number(bet.directionOddsLocked),
        predictedHomeScore: bet.predictedHomeScore,
        predictedAwayScore: bet.predictedAwayScore,
        scoreStake: bet.scoreStake,
        scoreOddsLocked: Number(bet.scoreOddsLocked),
        totalStake: bet.totalStake,
        status: bet.status,
        directionOutcome: bet.directionOutcome,
        scoreOutcome: bet.scoreOutcome,
        payout: bet.payout,
      },
    ])
  );
  const upcomingForDisplay = upcoming.map((match) => ({
    id: match.id,
    groupLabel: match.groupLabel,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoff: new Date(match.kickoff).toISOString(),
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    oddsHome: match.oddsHome != null ? Number(match.oddsHome) : null,
    oddsDraw: match.oddsDraw != null ? Number(match.oddsDraw) : null,
    oddsAway: match.oddsAway != null ? Number(match.oddsAway) : null,
    scoreOdds: match.scoreOdds ?? null,
  }));

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {heading}
        </h2>
      </div>
      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {emptyLabel}
        </p>
      ) : (
        <DashboardMatchGroups
          matches={upcomingForDisplay}
          roomCode={roomCode}
          myBets={myBetByMatch}
          customBetCounts={customBetCounts}
          maxStake={myChips}
          defaultDirectionStake={defaultDirectionStake}
          defaultScoreStake={defaultScoreStake}
        />
      )}
    </section>
  );
}

async function DashboardCustomBetsPane({
  trace,
  roomId,
  roomCode,
  userId,
  myChips,
  heading,
  emptyLabel,
  targetCustomBetId,
}: {
  trace: DashboardTrace;
  roomId: string;
  roomCode: string;
  userId: string;
  myChips: number;
  heading: string;
  emptyLabel: string;
  targetCustomBetId?: string | null;
}) {
  const customBets = await trace.step(
    "listOpenCustomBets",
    () => listOpenCustomBets(roomId, 100),
    (rows) => ({
      customBetCount: rows.length,
    })
  );

  const customBetDetails = await trace.step(
    "hydrateCustomBetDetails",
    () => hydrateCustomBetRowsWithWagers(customBets, userId),
    (rows) => ({
      customBetCount: rows.length,
      totalCustomWagers: rows.reduce(
        (total, entry) => total + entry.allWagers.length,
        0
      ),
      betsWithAnyWagers: rows.filter((entry) => entry.allWagers.length > 0).length,
      betsWithMyWager: rows.filter((entry) => entry.myWager != null).length,
    })
  );

  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {heading}
          </h2>
        </div>
      </div>

      <div className="mb-4">
        <ProposeBetModal roomCode={roomCode} />
      </div>

      {customBetDetails.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-3">
          {customBetDetails.map(
            ({
              bet,
              proposerName,
              matchHomeTeam,
              matchAwayTeam,
              myWager,
              allWagers,
            }) => (
              <CustomBetCard
                key={bet.id}
                bet={bet}
                proposerName={proposerName}
                viewerUserId={userId}
                roomCode={roomCode}
                matchId={bet.matchId ?? undefined}
                contextLabel={
                  matchHomeTeam && matchAwayTeam
                    ? `${matchHomeTeam} vs ${matchAwayTeam}`
                    : "Room-wide bet"
                }
                contextHref={
                  bet.matchId
                    ? `/r/${roomCode}/match/${bet.matchId}?from=dashboard`
                    : null
                }
                highlighted={targetCustomBetId === bet.id}
                myWager={myWager}
                myChips={myChips}
                wagers={allWagers}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

function DashboardMatchesPaneSkeleton({ heading }: { heading: string }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {heading}
        </h2>
      </div>
      <div className="space-y-2">
        <DashboardMatchCardSkeleton />
        <DashboardMatchCardSkeleton />
        <DashboardMatchCardSkeleton />
      </div>
    </section>
  );
}

function DashboardMatchCardSkeleton() {
  return (
    <article className="rounded-[26px] border border-[#dbe5f2] bg-white p-5 shadow-[0_14px_32px_rgba(30,58,138,0.08)]">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-3 w-16 rounded-full bg-slate-200" />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded-full bg-slate-200" />
            <div className="h-3 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="h-8 w-12 rounded-2xl bg-[#F3F7FD]" />
          <div className="space-y-2 text-right">
            <div className="ml-auto h-4 w-24 rounded-full bg-slate-200" />
            <div className="ml-auto h-3 w-16 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 rounded-2xl bg-[#F8FBFF] ring-1 ring-[#dbe5f2]" />
          <div className="h-12 rounded-2xl bg-[#F8FBFF] ring-1 ring-[#dbe5f2]" />
          <div className="h-12 rounded-2xl bg-[#F8FBFF] ring-1 ring-[#dbe5f2]" />
        </div>
      </div>
    </article>
  );
}

function DashboardCustomBetsPaneSkeleton({ heading }: { heading: string }) {
  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {heading}
          </h2>
        </div>
      </div>

      <div className="mb-4 h-12 w-full animate-pulse rounded-[20px] bg-[#F3F7FD]" />

      <div className="space-y-3">
        <DashboardCustomBetCardSkeleton />
        <DashboardCustomBetCardSkeleton />
      </div>
    </section>
  );
}

function DashboardCustomBetCardSkeleton() {
  return (
    <article className="rounded-[26px] border border-[#dbe5f2] bg-white p-5 shadow-[0_14px_32px_rgba(30,58,138,0.07)]">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-3 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="h-6 w-3/4 rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-full bg-slate-100" />
        <div className="h-4 w-5/6 rounded-full bg-slate-100" />
        <div className="rounded-2xl border border-[#e7eef8] bg-[#F8FBFF] p-4">
          <div className="h-4 w-20 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-10 rounded-2xl bg-white ring-1 ring-[#dbe5f2]" />
            <div className="h-10 rounded-2xl bg-white ring-1 ring-[#dbe5f2]" />
          </div>
        </div>
      </div>
    </article>
  );
}
