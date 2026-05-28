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
import BetForm from "@/components/BetForm";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";

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
}) {
  const { code, id } = await props.params;
  const { room, user } = await requireRoomUser(code);

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
  const isLocked = kickoff.getTime() <= Date.now() || match.status !== "scheduled";
  const hasDirectionOdds = match.oddsHome && match.oddsDraw && match.oddsAway;
  const hasScoreOdds = !!match.scoreOdds;
  const hasOdds = hasDirectionOdds && hasScoreOdds;

  const oddsHome = Number(match.oddsHome ?? 0);
  const oddsDraw = Number(match.oddsDraw ?? 0);
  const oddsAway = Number(match.oddsAway ?? 0);

  return (
    <>
      <RoomHeader room={room} user={user} />
      <AutoRefresh />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Group {match.groupLabel}</span>
            <span>{formatKickoff(kickoff)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-2xl font-semibold">
            <span>{match.homeTeam}</span>
            {match.homeScore != null && match.awayScore != null ? (
              <span className="font-mono">
                {match.homeScore} : {match.awayScore}
              </span>
            ) : (
              <span className="text-zinc-400">vs</span>
            )}
            <span>{match.awayTeam}</span>
          </div>
          {match.status === "final" && (
            <p className="mt-2 text-center text-sm text-zinc-500">Final</p>
          )}

          {hasDirectionOdds && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {match.homeTeam}
                </div>
                <div className="font-mono text-lg font-semibold">
                  {oddsHome.toFixed(2)}x
                </div>
              </div>
              <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Draw
                </div>
                <div className="font-mono text-lg font-semibold">
                  {oddsDraw.toFixed(2)}x
                </div>
              </div>
              <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {match.awayTeam}
                </div>
                <div className="font-mono text-lg font-semibold">
                  {oddsAway.toFixed(2)}x
                </div>
              </div>
            </div>
          )}
        </section>

        {myBet ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Your prediction
            </h3>
            <p className="mt-1 text-lg font-semibold">
              {match.homeTeam} {myBet.predictedHomeScore} – {myBet.predictedAwayScore} {match.awayTeam}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/60 px-3 py-2 dark:bg-zinc-900/40">
                <div className="text-zinc-500">Direction</div>
                <div>
                  {myBet.directionStake} chips @{" "}
                  <span className="font-mono">{Number(myBet.directionOddsLocked).toFixed(2)}x</span>{" "}
                  <span className="text-zinc-500">
                    ({myBet.directionOutcome === "pending" ? "open" : myBet.directionOutcome})
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-white/60 px-3 py-2 dark:bg-zinc-900/40">
                <div className="text-zinc-500">Exact score</div>
                <div>
                  {myBet.scoreStake} chips @{" "}
                  <span className="font-mono">{Number(myBet.scoreOddsLocked).toFixed(2)}x</span>{" "}
                  <span className="text-zinc-500">
                    ({myBet.scoreOutcome === "pending" ? "open" : myBet.scoreOutcome})
                  </span>
                </div>
              </div>
            </div>
            {myBet.status === "settled" && (
              <p className="mt-2 text-sm">
                Settled. Payout: <span className="font-mono font-semibold">{myBet.payout ?? 0}</span> chips.
              </p>
            )}
          </section>
        ) : isLocked ? (
          <section className="rounded-2xl border border-zinc-300 bg-zinc-100 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Betting closed — kickoff has passed.
          </section>
        ) : !hasOdds ? (
          <section className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            Odds haven't been generated yet. Ask any room member to run{" "}
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
              npm run odds:generate
            </code>{" "}
            or hit "Generate odds" on the admin page.
          </section>
        ) : (
          <BetForm
            roomCode={room.code}
            matchId={match.id}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            oddsHome={oddsHome}
            oddsDraw={oddsDraw}
            oddsAway={oddsAway}
            scoreOdds={match.scoreOdds!}
            maxStake={user.chips}
          />
        )}

        {allBets.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Predictions on this match
            </h2>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {allBets.map(({ bet, userName }) => (
                <li key={bet.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{userName}</span>:{" "}
                    <span className="font-mono">
                      {bet.predictedHomeScore} – {bet.predictedAwayScore}
                    </span>
                  </span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {bet.totalStake} chips
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Custom bets
            </h2>
            <span className="text-xs text-zinc-500">
              {customBetDetails.length} active
            </span>
          </div>

          {match.status !== "final" && (
            <div className="mb-3">
              <ProposeBetModal roomCode={room.code} matchId={match.id} />
            </div>
          )}

          {customBetDetails.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No custom bets on this match yet.
            </p>
          ) : (
            <div className="space-y-2">
              {customBetDetails.map(({ bet, proposerName, myWager, allWagers }) => (
                <CustomBetCard
                  key={bet.id}
                  bet={bet}
                  proposerName={proposerName}
                  roomCode={room.code}
                  matchId={match.id}
                  myWager={myWager}
                  myChips={user.chips}
                  wagers={allWagers}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
