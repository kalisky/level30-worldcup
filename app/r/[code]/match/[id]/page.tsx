import { notFound } from "next/navigation";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getCustomWagersFor,
  getMatch,
  getMatchBetForUser,
  getMatchBetsForMatch,
  getMyWagerOnCustomBet,
  listCustomBetsForMatch,
} from "@/lib/db/queries";
import RoomHeader from "@/components/RoomHeader";
import AutoRefresh from "@/components/AutoRefresh";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";
import MatchBetPanel from "@/components/MatchBetPanel";
import MatchScreenLayout from "@/components/MatchScreenLayout";
import TeamFlag from "@/components/TeamFlag";
import { getTeamAbbreviation } from "@/lib/team-flags";
import DailyGrantBanner from "@/components/DailyGrantBanner";

function formatKickoff(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MatchPage(props: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{ bet?: string | string[] | undefined }>;
}) {
  const { code, id } = await props.params;
  const searchParams = await props.searchParams;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);
  const targetCustomBetId = Array.isArray(searchParams.bet)
    ? searchParams.bet[0]
    : searchParams.bet;

  const match = await getMatch(id);
  if (!match) notFound();

  const [myBet, allBets, customBetRows] = await Promise.all([
    getMatchBetForUser(room.id, user.id, id),
    getMatchBetsForMatch(room.id, id),
    listCustomBetsForMatch(room.id, id),
  ]);

  const customBetDetails = await Promise.all(
    customBetRows.map(async (row) => {
      const [myWager, allWagers] = await Promise.all([
        getMyWagerOnCustomBet(row.bet.id, user.id),
        getCustomWagersFor(row.bet.id),
      ]);
      return { ...row, myWager, allWagers };
    })
  );

  const kickoff = new Date(match.kickoff);
  const oddsHome = Number(match.oddsHome ?? 0);
  const oddsDraw = Number(match.oddsDraw ?? 0);
  const oddsAway = Number(match.oddsAway ?? 0);
  const homeTeamAbbreviation = getTeamAbbreviation(match.homeTeam);
  const awayTeamAbbreviation = getTeamAbbreviation(match.awayTeam);

  const matchPane = (
    <>
      <section className="rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_18px_42px_rgba(30,58,138,0.08)]">
        <div className="flex items-center justify-between gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
          <span>Group {match.groupLabel}</span>
          <span>{formatKickoff(kickoff)}</span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
            <div className="min-w-0 max-w-[7rem] sm:max-w-[12rem]">
              <div className="text-xl font-black leading-tight text-[#1E3A8A] sm:text-2xl">
                <span className="sm:hidden">{homeTeamAbbreviation}</span>
                <span className="hidden break-words sm:inline">
                  {match.homeTeam}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Home
              </div>
            </div>
            <TeamFlag teamName={match.homeTeam} size={40} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="rounded-full bg-[#F8FBFF] px-4 py-1.5 font-mono text-base font-black tracking-[0.22em] text-[#1E3A8A] ring-1 ring-[#dbe5f2]">
              {match.homeScore != null && match.awayScore != null
                ? `${match.homeScore} : ${match.awayScore}`
                : "VS"}
            </span>
            {match.status === "final" ? (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-slate-700">
                Final
              </span>
            ) : match.status === "live" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#EA580C]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Live
              </span>
            ) : (
              <span className="rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#1D4ED8]">
                Scheduled
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <TeamFlag teamName={match.awayTeam} size={40} />
            <div className="min-w-0 max-w-[7rem] sm:max-w-[12rem]">
              <div className="text-xl font-black leading-tight text-[#1E3A8A] sm:text-2xl">
                <span className="sm:hidden">{awayTeamAbbreviation}</span>
                <span className="hidden break-words sm:inline">
                  {match.awayTeam}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Away
              </div>
            </div>
          </div>
        </div>

        {match.oddsHome && match.oddsDraw && match.oddsAway && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {match.homeTeam}
              </div>
              <div className="mt-1 font-mono text-xl font-black text-[#1E3A8A]">
                {oddsHome.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Draw
              </div>
              <div className="mt-1 font-mono text-xl font-black text-[#1E3A8A]">
                {oddsDraw.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {match.awayTeam}
              </div>
              <div className="mt-1 font-mono text-xl font-black text-[#1E3A8A]">
                {oddsAway.toFixed(2)}x
              </div>
            </div>
          </div>
        )}
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
      />

      {allBets.length > 0 && (
        <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
          <h2 className="mb-3 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            Predictions on this match
          </h2>
          <ul className="divide-y divide-[#e7eef8] overflow-hidden rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF]">
            {allBets.map(({ bet, userName }) => (
              <li
                key={bet.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-bold text-[#1E3A8A]">{userName}</span>:{" "}
                  <span className="font-mono font-bold text-slate-700">
                    {bet.predictedHomeScore} – {bet.predictedAwayScore}
                  </span>
                </span>
                <span className="font-mono font-semibold text-slate-500">
                  {bet.totalStake} chips
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  const customBetsPane = (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            Custom bets
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Side quests, chaos, and live prop bets from the room.
          </p>
        </div>
        <span className="rounded-full bg-[#F8FBFF] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-[#dbe5f2]">
          {customBetDetails.length} active
        </span>
      </div>

      {match.status !== "final" && (
        <div className="mb-4">
          <ProposeBetModal
            roomCode={room.code}
            matchId={match.id}
            matchLabel={`${match.homeTeam} vs ${match.awayTeam}`}
            matchKickoff={new Date(match.kickoff).toISOString()}
          />
        </div>
      )}

      {customBetDetails.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          No custom bets on this match yet.
        </p>
      ) : (
        <div className="space-y-3">
          {customBetDetails.map(({ bet, proposerName, myWager, allWagers }) => (
            <CustomBetCard
              key={bet.id}
              bet={bet}
              proposerName={proposerName}
              roomCode={room.code}
              matchId={match.id}
              highlighted={targetCustomBetId === bet.id}
              myWager={myWager}
              myChips={user.chips}
              wagers={allWagers}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <RoomHeader room={room} user={user} />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <AutoRefresh />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <MatchScreenLayout
          matchPane={matchPane}
          customBetsPane={customBetsPane}
          targetCustomBetId={targetCustomBetId}
        />
      </main>
    </>
  );
}
