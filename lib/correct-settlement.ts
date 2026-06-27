import { and, eq, sql } from "drizzle-orm";
import type { db } from "@/lib/db";
import { matchBets, matches, users, type Match } from "@/lib/db/schema";
import { recordLedger } from "@/lib/ledger";
import { isKnockout } from "@/lib/knockout";
import { settleMatchBetsForRoom } from "@/lib/settle-match-core";
import { touchMatchLiveRevisions } from "@/lib/live-updates";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type CorrectMatchSettlementResult = {
  /** The match whose score was (re)written. */
  matchId: string;
  /** True if the recorded match score was changed. */
  scoreChanged: boolean;
  fromScore: string | null;
  toScore: string;
  roomsResettled: number;
  betsResettled: number;
  chipsReversed: number;
  chipsPaidOut: number;
};

/**
 * Re-settles a match across every room from a clean slate: writes the
 * (corrected) final score, reverses any prior payouts, reopens settled bets,
 * then settles them again via {@link settleMatchBetsForRoom} — the single
 * source of truth for payout math (ceil-rounded). This is the shared engine
 * behind both the manual `match:correct-settlement` script and the morning
 * verification cron's auto-fix.
 *
 * Runs in its own transaction unless an existing `tx` is supplied.
 */
export async function correctMatchSettlement(
  database: Db | Tx,
  args: {
    match: Match;
    homeScore: number;
    awayScore: number;
    /** Knockout only: which side advanced. Written to the match + used to
     *  settle the 2-way direction bet. */
    advancer?: "HOME" | "AWAY" | null;
    /**
     * Attributed to the `settlements.actorId` audit column per room. Defaults
     * to null, recorded as "resolved by the server" (cron / automated). The
     * CLI script passes a resolver that attributes to the room creator.
     */
    actorIdForRoom?: (
      roomId: string
    ) => Promise<string | null> | string | null;
  }
): Promise<CorrectMatchSettlementResult> {
  // `transaction` exists on the top-level db but not on an active tx handle.
  const hasTransaction = (
    value: Db | Tx
  ): value is Db => typeof (value as Db).transaction === "function";

  const run = async (tx: Tx): Promise<CorrectMatchSettlementResult> => {
    const { match, homeScore, awayScore } = args;
    const knockout = isKnockout(match.groupLabel);
    const advancer = knockout ? args.advancer ?? null : null;
    const resolveActor = args.actorIdForRoom ?? (() => null);

    const fromScore =
      match.homeScore != null && match.awayScore != null
        ? `${match.homeScore}-${match.awayScore}`
        : null;
    const toScore = `${homeScore}-${awayScore}`;
    const scoreChanged =
      match.status !== "final" ||
      match.homeScore !== homeScore ||
      match.awayScore !== awayScore ||
      (knockout && match.advancer !== advancer);

    const correctedMatch: Match = {
      ...match,
      homeScore,
      awayScore,
      status: "final",
      advancer,
    };

    if (scoreChanged) {
      await tx
        .update(matches)
        .set({
          homeScore,
          awayScore,
          status: "final",
          ...(knockout ? { advancer } : {}),
        })
        .where(eq(matches.id, match.id));
      await touchMatchLiveRevisions(tx, match.id);
    }

    const roomRows = await tx
      .selectDistinct({ roomId: matchBets.roomId })
      .from(matchBets)
      .where(eq(matchBets.matchId, match.id));

    let roomsResettled = 0;
    let betsResettled = 0;
    let chipsReversed = 0;
    let chipsPaidOut = 0;

    for (const { roomId } of roomRows) {
      // Reverse + reopen every already-settled bet so the new settlement is
      // computed from scratch (settleMatchBetsForRoom only touches "open").
      const settledBets = await tx
        .select()
        .from(matchBets)
        .where(
          and(
            eq(matchBets.roomId, roomId),
            eq(matchBets.matchId, match.id),
            eq(matchBets.status, "settled")
          )
        );

      for (const bet of settledBets) {
        const payoutToReverse = bet.payout ?? 0;
        if (payoutToReverse > 0) {
          const [updatedUser] = await tx
            .update(users)
            .set({ chips: sql`${users.chips} - ${payoutToReverse}` })
            .where(eq(users.id, bet.userId))
            .returning({ chips: users.chips });
          chipsReversed += payoutToReverse;
          await recordLedger(tx, {
            roomId,
            userId: bet.userId,
            delta: -payoutToReverse,
            balanceAfter: updatedUser.chips,
            reason: "match_bet_payout",
            refMatchId: match.id,
            note: `Settlement correction - reversed incorrect payout from ${
              fromScore ?? "unsettled"
            } before re-settling as ${toScore}`,
          });
        }
      }

      if (settledBets.length > 0) {
        await tx
          .update(matchBets)
          .set({
            status: "open",
            directionOutcome: "pending",
            scoreOutcome: "pending",
            payout: null,
          })
          .where(
            and(
              eq(matchBets.roomId, roomId),
              eq(matchBets.matchId, match.id),
              eq(matchBets.status, "settled")
            )
          );
      }

      const actorId = await resolveActor(roomId);
      const result = await settleMatchBetsForRoom(tx, {
        roomId,
        actorId,
        match: correctedMatch,
        homeScore,
        awayScore,
        advancer,
        repair: true,
      });
      if (result.betsSettled > 0) roomsResettled += 1;
      betsResettled += result.betsSettled;
      chipsPaidOut += result.totalPaidOut;
    }

    return {
      matchId: match.id,
      scoreChanged,
      fromScore,
      toScore,
      roomsResettled,
      betsResettled,
      chipsReversed,
      chipsPaidOut,
    };
  };

  if (hasTransaction(database)) {
    return database.transaction(run);
  }
  return run(database);
}
