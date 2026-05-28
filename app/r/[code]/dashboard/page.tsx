import Link from "next/link";
import { requireRoomUser } from "@/lib/auth-context";
import {
  getMyMatchBets,
  getRoomUsers,
  listOpenCustomBets,
  listUpcomingMatches,
} from "@/lib/db/queries";
import RoomHeader from "@/components/RoomHeader";
import Leaderboard from "@/components/Leaderboard";
import MatchCard from "@/components/MatchCard";
import AutoRefresh from "@/components/AutoRefresh";

export default async function DashboardPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const { room, user } = await requireRoomUser(code);

  const [members, upcoming, customBets, myBets] = await Promise.all([
    getRoomUsers(room.id),
    listUpcomingMatches(8),
    listOpenCustomBets(room.id, 10),
    getMyMatchBets(room.id, user.id),
  ]);

  const myPredictionByMatch = new Map(
    myBets.map((b) => [b.matchId, { home: b.predictedHomeScore, away: b.predictedAwayScore }] as const)
  );

  return (
    <>
      <RoomHeader room={room} user={user} active="dashboard" />
      <AutoRefresh />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-6">
        <Leaderboard users={members} meId={user.id} />

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Upcoming & live matches
          </h2>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No matches scheduled. Run <code>npm run seed</code> to load
              fixtures.
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

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Live custom bets
            </h2>
          </div>
          {customBets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No open custom bets right now. Propose one from a match page
              during the game.
            </p>
          ) : (
            <ul className="space-y-2">
              {customBets.map(({ bet, proposerName }) => (
                <li key={bet.id}>
                  <Link
                    href={`/r/${room.code}/match/${bet.matchId ?? ""}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{bet.title}</h3>
                      <span className="text-xs text-zinc-500">
                        by {proposerName}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {bet.options.map((o, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
                        >
                          {o.label} · {o.odds.toFixed(2)}x
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
