import { and, desc, eq, inArray } from "drizzle-orm";
import { requireRoomUser } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { customBets, matches, users } from "@/lib/db/schema";
import { listRecentSettlements } from "@/lib/db/queries";
import RoomHeader from "@/components/RoomHeader";
import SettleMatchForm from "@/components/SettleMatchForm";
import SettleCustomBet from "@/components/SettleCustomBet";

export default async function AdminPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const { room, user } = await requireRoomUser(code);

  const [allMatches, openBets, recent] = await Promise.all([
    db.select().from(matches).orderBy(matches.kickoff),
    db
      .select({ bet: customBets, proposerName: users.name })
      .from(customBets)
      .innerJoin(users, eq(users.id, customBets.proposerId))
      .where(
        and(
          eq(customBets.roomId, room.id),
          inArray(customBets.status, ["open", "locked"])
        )
      )
      .orderBy(desc(customBets.createdAt)),
    listRecentSettlements(room.id, 30),
  ]);

  // Split matches into 'needs attention' (past kickoff, not final) and rest.
  const now = Date.now();
  const needsAttention = allMatches.filter(
    (m) => m.status !== "final" && new Date(m.kickoff).getTime() <= now
  );
  const upcoming = allMatches.filter(
    (m) => m.status !== "final" && new Date(m.kickoff).getTime() > now
  );
  const completed = allMatches.filter((m) => m.status === "final");

  return (
    <>
      <RoomHeader room={room} user={user} active="admin" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Needs settlement ({needsAttention.length})
          </h2>
          {needsAttention.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing pending.</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.map((m) => (
                <SettleMatchForm key={m.id} match={m} roomCode={room.code} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Open custom bets ({openBets.length})
          </h2>
          {openBets.length === 0 ? (
            <p className="text-sm text-zinc-500">No custom bets to resolve.</p>
          ) : (
            <div className="space-y-2">
              {openBets.map(({ bet, proposerName }) => (
                <SettleCustomBet
                  key={bet.id}
                  bet={bet}
                  roomCode={room.code}
                  proposerName={proposerName}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Upcoming matches ({upcoming.length})
            </summary>
            <div className="mt-3 space-y-2">
              {upcoming.map((m) => (
                <SettleMatchForm key={m.id} match={m} roomCode={room.code} />
              ))}
            </div>
          </details>
        </section>

        <section>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Completed ({completed.length})
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm">
              {completed.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span>
                    {m.homeTeam} {m.homeScore} – {m.awayScore} {m.awayTeam}
                  </span>
                  <span className="text-xs text-zinc-500">Group {m.groupLabel}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent settlements
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recent.map(({ settlement, actorName }) => (
                <li
                  key={settlement.id}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {settlement.kind === "match"
                        ? "Match settled"
                        : settlement.kind === "custom_bet"
                          ? "Custom bet settled"
                          : "Custom bet voided"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      by {actorName} ·{" "}
                      {new Date(settlement.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                    {JSON.stringify(settlement.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
