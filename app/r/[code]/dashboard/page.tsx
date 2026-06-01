import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getMyMatchBets,
  hydrateCustomBetRowsWithWagers,
  listOpenCustomBets,
  listRoomsForAuthUser,
  listUpcomingMatches,
} from "@/lib/db/queries";
import { getCustomBetShareMetadata } from "@/lib/share-metadata";
import RoomHeader from "@/components/RoomHeader";
import MatchCard from "@/components/MatchCard";
import AutoRefresh from "@/components/AutoRefresh";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";
import MatchScreenLayout from "@/components/MatchScreenLayout";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import CopyBetsLauncher from "@/components/CopyBetsLauncher";
import { createDashboardTrace } from "@/lib/dashboard-trace";
import { getDashboardLiveToken } from "@/lib/live-updates";

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
      const t = await trace.step("getTranslations", () => getTranslations("dashboard"));
      const tnav = await getTranslations("nav");

      const [upcoming, customBets, myBets, allRoomMemberships] = await Promise.all([
          trace.step("listUpcomingMatches", () => listUpcomingMatches(100), (rows) => ({
            upcomingMatchCount: rows.length,
          })),
          trace.step(
            "listOpenCustomBets",
            () => listOpenCustomBets(room.id, 100),
            (rows) => ({
              customBetCount: rows.length,
            })
          ),
          trace.step("getMyMatchBets", () => getMyMatchBets(room.id, user.id), (rows) => ({
            myBetCount: rows.length,
          })),
          trace.step(
            "listRoomsForAuthUser",
            () =>
              user.authUserId ? listRoomsForAuthUser(user.authUserId) : Promise.resolve([]),
            (rows) => ({
              membershipCount: rows.length,
              hasAuthUserId: Boolean(user.authUserId),
            })
          ),
        ]);

      const otherRooms = allRoomMemberships
        .filter((r) => r.room.id !== room.id)
        .map((r) => ({ code: r.room.code, name: r.room.name }));

      const customBetDetails = await trace.step(
        "hydrateCustomBetDetails",
        () => hydrateCustomBetRowsWithWagers(customBets, user.id),
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

      const myPredictionByMatch = new Map(
        myBets.map(
          (b) =>
            [b.matchId, { home: b.predictedHomeScore, away: b.predictedAwayScore }] as const
        )
      );

      const liveToken = await trace.step("getDashboardLiveToken", () =>
        getDashboardLiveToken({
          roomId: room.id,
          startingChips: room.startingChips,
          lastDailyGrantAt: user.lastDailyGrantAt,
        })
      );

      trace.end({
        upcomingMatchCount: upcoming.length,
        customBetCount: customBets.length,
        otherRoomCount: otherRooms.length,
      });

      return {
        room,
        user,
        dailyGrantApplied,
        t,
        tnav,
        upcoming,
        customBets,
        customBetDetails,
        otherRooms,
        myPredictionByMatch,
        liveToken,
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
    t,
    tnav,
    upcoming,
    customBets,
    customBetDetails,
    otherRooms,
    myPredictionByMatch,
    liveToken,
  } = dashboardData;

  const mobileDashboardHeader = (
    <section className="rounded-[22px] border border-[#dbe5f2] bg-white p-4 shadow-[0_12px_28px_rgba(30,58,138,0.08)] lg:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.24em] text-slate-500">
            {room.code}
          </p>
          <h1 className="mt-1 truncate text-[1.35rem] font-black text-[#1E3A8A]">
            {room.name}
          </h1>
        </div>

        <nav className="flex flex-wrap gap-2">
          <Link
            href={`/r/${room.code}/history`}
            className="rounded-full border border-[#dbe5f2] bg-[#F8FBFF] px-3.5 py-1.5 text-xs font-bold text-[#1E3A8A] transition hover:bg-white"
          >
            {tnav("history")}
          </Link>
          <Link
            href={`/r/${room.code}/leaderboard`}
            className="rounded-full border border-[#dbe5f2] bg-[#FFF1E8] px-3.5 py-1.5 text-xs font-bold text-[#EA580C] transition hover:bg-white"
          >
            {tnav("leaderboard")}
          </Link>
        </nav>
      </div>
    </section>
  );

  const dashboardPane = (
    <>
      <section className="hidden rounded-[24px] border border-[#dbe5f2] bg-white p-4 shadow-[0_16px_38px_rgba(30,58,138,0.08)] lg:block">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.26em] text-slate-500">
              {room.code}
            </p>
            <h1 className="mt-1 truncate text-[1.75rem] font-black text-[#1E3A8A]">
              {room.name}
            </h1>
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link
              href={`/r/${room.code}/history`}
              className="rounded-full border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-2 text-sm font-bold text-[#1E3A8A] transition hover:bg-white"
            >
              {tnav("history")}
            </Link>
            <Link
              href={`/r/${room.code}/leaderboard`}
              className="rounded-full border border-[#dbe5f2] bg-[#FFF1E8] px-4 py-2 text-sm font-bold text-[#EA580C] transition hover:bg-white"
            >
              {tnav("leaderboard")}
            </Link>
          </nav>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("upcomingMatches")}
          </h2>
          <CopyBetsLauncher targetRoomCode={room.code} otherRooms={otherRooms} />
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("noMatches")}
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                roomCode={room.code}
                myPrediction={myPredictionByMatch.get(m.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );

  const customBetsPane = (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {t("customBets")}
          </h2>
        </div>
      </div>

      <div className="mb-4">
        <ProposeBetModal roomCode={room.code} />
      </div>

      {customBets.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          {t("noCustomBets")}
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
                roomCode={room.code}
                matchId={bet.matchId ?? undefined}
                contextLabel={
                  matchHomeTeam && matchAwayTeam
                    ? `${matchHomeTeam} vs ${matchAwayTeam}`
                    : "Room-wide bet"
                }
                contextHref={
                  bet.matchId
                    ? `/r/${room.code}/match/${bet.matchId}?from=dashboard`
                    : null
                }
                highlighted={targetCustomBetId === bet.id}
                myWager={myWager}
                myChips={user.chips}
                wagers={allWagers}
              />
            )
          )}
        </div>
      )}
    </section>
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
        liveToken={liveToken}
        pollUrl={`/api/live/room/${encodeURIComponent(room.code)}/dashboard`}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-4 lg:hidden">{mobileDashboardHeader}</div>
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
