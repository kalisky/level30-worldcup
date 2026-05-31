import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getCustomWagersFor,
  getMyMatchBets,
  getMyWagerOnCustomBet,
  getRoomUsers,
  listOpenCustomBets,
  listRoomsForAuthUser,
  listUpcomingMatches,
} from "@/lib/db/queries";
import { getCustomBetShareMetadata } from "@/lib/share-metadata";
import RoomHeader from "@/components/RoomHeader";
import Leaderboard from "@/components/Leaderboard";
import MatchCard from "@/components/MatchCard";
import AutoRefresh from "@/components/AutoRefresh";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";
import MatchScreenLayout from "@/components/MatchScreenLayout";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import CopyBetsLauncher from "@/components/CopyBetsLauncher";

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
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);
  const t = await getTranslations("dashboard");
  const targetCustomBetId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;
  const roomWasCreated = Array.isArray(searchParams.created)
    ? searchParams.created[0] === "1"
    : searchParams.created === "1";

  const [members, upcoming, customBets, myBets, allRoomMemberships] = await Promise.all([
    getRoomUsers(room.id),
    listUpcomingMatches(100),
    listOpenCustomBets(room.id, 100),
    getMyMatchBets(room.id, user.id),
    user.authUserId ? listRoomsForAuthUser(user.authUserId) : Promise.resolve([]),
  ]);

  const otherRooms = allRoomMemberships
    .filter((r) => r.room.id !== room.id)
    .map((r) => ({ code: r.room.code, name: r.room.name }));

  const customBetDetails = await Promise.all(
    customBets.map(async (row) => {
      const [myWager, allWagers] = await Promise.all([
        getMyWagerOnCustomBet(row.bet.id, user.id),
        getCustomWagersFor(row.bet.id),
      ]);

      return {
        ...row,
        myWager,
        allWagers,
      };
    })
  );

  const myPredictionByMatch = new Map(
    myBets.map((b) => [b.matchId, { home: b.predictedHomeScore, away: b.predictedAwayScore }] as const)
  );

  const dashboardPane = (
    <>
      <Leaderboard users={members} meId={user.id} roomCode={room.code} />

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
                  bet.matchId ? `/r/${room.code}/match/${bet.matchId}` : null
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
      <AutoRefresh />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
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
