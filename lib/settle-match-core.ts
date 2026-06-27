import { and, eq, sql } from "drizzle-orm";
import type { db } from "@/lib/db";
import {
  customBets,
  matchBets,
  settlements,
  users,
  type Match,
  type MatchBet,
} from "@/lib/db/schema";
import { recordLedger } from "@/lib/ledger";
import { isKnockout } from "@/lib/knockout";
import {
  touchMatchLiveRevisions,
  touchRoomLiveRevision,
} from "@/lib/live-updates";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type MatchBetSettlement = {
  directionWon: boolean;
  scoreWon: boolean;
  directionPayout: number;
  scorePayout: number;
  payout: number;
  directionOutcome: "won" | "lost";
  scoreOutcome: "won" | "lost";
};

/**
 * The single source of truth for match-bet payout math. A score prediction is
 * two independent bets sharing the stake 50/50: a direction bet and an
 * exact-score bet, each paid at the locked odds (ceil-rounded). Used by
 * settlement, the correction engine, and the verification cron so they can
 * never drift apart.
 *
 * Group stage: the direction is derived from the score (HOME/DRAW/AWAY), and a
 * draw scoreline means the DRAW side wins.
 *
 * Knockout (pass `opts.advancer`): the direction bet is 2-way — it wins if the
 * user's pick matches the side that ADVANCED (regulation, extra time, or
 * penalties). The exact-score bet still uses the legal-time score in
 * homeScore/awayScore, which may be a draw. If `advancer` is null (not yet
 * known) the direction can't win.
 */
export function computeMatchBetSettlement(
  bet: Pick<
    MatchBet,
    | "directionPick"
    | "predictedHomeScore"
    | "predictedAwayScore"
    | "directionStake"
    | "scoreStake"
    | "directionOddsLocked"
    | "scoreOddsLocked"
  >,
  homeScore: number,
  awayScore: number,
  opts?: { knockout?: boolean; advancer?: "HOME" | "AWAY" | null }
): MatchBetSettlement {
  const directionWon = opts?.knockout
    ? opts.advancer != null && bet.directionPick === opts.advancer
    : bet.directionPick ===
      (homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : "DRAW");
  const scoreWon =
    bet.predictedHomeScore === homeScore &&
    bet.predictedAwayScore === awayScore;

  const directionPayout = directionWon
    ? Math.ceil(bet.directionStake * Number(bet.directionOddsLocked))
    : 0;
  const scorePayout = scoreWon
    ? Math.ceil(bet.scoreStake * Number(bet.scoreOddsLocked))
    : 0;

  return {
    directionWon,
    scoreWon,
    directionPayout,
    scorePayout,
    payout: directionPayout + scorePayout,
    directionOutcome: directionWon ? "won" : "lost",
    scoreOutcome: scoreWon ? "won" : "lost",
  };
}

/**
 * Settles one room's open bets on a match whose final score is known.
 * Matches are shared across rooms, so this runs once per room — the caller
 * is responsible for recording the final score on the match exactly once.
 */
export async function settleMatchBetsForRoom(
  tx: Db | Tx,
  args: {
    roomId: string;
    /** NULL when settled by the server-side auto-settler. */
    actorId: string | null;
    match: Match;
    homeScore: number;
    awayScore: number;
    /** Knockout only: which side advanced. Defaults to match.advancer. */
    advancer?: "HOME" | "AWAY" | null;
    repair?: boolean;
  }
): Promise<{ betsSettled: number; totalPaidOut: number }> {
  const { roomId, actorId, match, homeScore, awayScore } = args;
  const knockout = isKnockout(match.groupLabel);
  const advancer = args.advancer ?? match.advancer ?? null;

  const openBets = await tx
    .select()
    .from(matchBets)
    .where(
      and(
        eq(matchBets.roomId, roomId),
        eq(matchBets.matchId, match.id),
        eq(matchBets.status, "open")
      )
    );

  let totalPaidOut = 0;
  for (const bet of openBets) {
    const { directionWon, scoreWon, payout } = computeMatchBetSettlement(
      bet,
      homeScore,
      awayScore,
      { knockout, advancer }
    );
    totalPaidOut += payout;

    if (payout > 0) {
      const [updatedUser] = await tx
        .update(users)
        .set({ chips: sql`${users.chips} + ${payout}` })
        .where(eq(users.id, bet.userId))
        .returning({ chips: users.chips });
      await recordLedger(tx, {
        roomId,
        userId: bet.userId,
        delta: payout,
        balanceAfter: updatedUser.chips,
        reason: "match_bet_payout",
        refMatchId: match.id,
        note: `${match.homeTeam} ${homeScore}–${awayScore} ${match.awayTeam}: ${directionWon ? "direction" : ""}${directionWon && scoreWon ? " + " : ""}${scoreWon ? "exact" : ""} hit`,
      });
    }
    await tx
      .update(matchBets)
      .set({
        status: "settled",
        directionOutcome: directionWon ? "won" : "lost",
        scoreOutcome: scoreWon ? "won" : "lost",
        payout,
      })
      .where(eq(matchBets.id, bet.id));
  }

  await tx
    .update(customBets)
    .set({ status: "locked" })
    .where(
      and(eq(customBets.matchId, match.id), eq(customBets.status, "open"))
    );

  await tx.insert(settlements).values({
    roomId,
    actorId,
    kind: "match",
    targetId: match.id,
    payload: {
      homeScore,
      awayScore,
      direction: knockout
        ? advancer
        : homeScore > awayScore
          ? "HOME"
          : awayScore > homeScore
            ? "AWAY"
            : "DRAW",
      ...(knockout ? { knockout: true, advancer } : {}),
      betsSettled: openBets.length,
      totalPaidOut,
      ...(args.repair ? { repair: true } : {}),
    },
  });

  await touchRoomLiveRevision(tx, roomId);
  await touchMatchLiveRevisions(tx, match.id);

  return { betsSettled: openBets.length, totalPaidOut };
}
