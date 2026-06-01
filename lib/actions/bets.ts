"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  matchBets,
  matches,
  users,
  scoreKey,
} from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";
import { recordLedger } from "@/lib/ledger";

// Direction pick and score prediction are now independent inputs from the
// UI — a user can bet HOME on the side but predict 2-1 South Africa for the
// exact score. The stakes for each are also independent (either may be 0,
// as long as the sum is at least 2).
const placeBetSchema = z
  .object({
    matchId: z.string().uuid(),
    directionPick: z.enum(["HOME", "DRAW", "AWAY"]),
    directionStake: z.number().int().min(0),
    predictedHomeScore: z.number().int().min(0).max(99),
    predictedAwayScore: z.number().int().min(0).max(99),
    scoreStake: z.number().int().min(0),
  })
  .refine((d) => d.directionStake + d.scoreStake >= 2, {
    message: "Total stake must be at least 2 chips.",
  });

function parseBetForm(formData: FormData) {
  return placeBetSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    directionPick: String(formData.get("directionPick") ?? ""),
    directionStake: Number(formData.get("directionStake") ?? 0),
    predictedHomeScore: Number(formData.get("predictedHomeScore") ?? -1),
    predictedAwayScore: Number(formData.get("predictedAwayScore") ?? -1),
    scoreStake: Number(formData.get("scoreStake") ?? 0),
  });
}

export async function placeMatchBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = parseBetForm(formData);
  if (!parsed.success) {
    throw new Error(
      "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const {
    matchId,
    directionPick,
    directionStake,
    predictedHomeScore,
    predictedAwayScore,
    scoreStake,
  } = parsed.data;
  const totalStake = directionStake + scoreStake;

  await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match) throw new Error("Match not found.");

    if (new Date(match.kickoff).getTime() <= Date.now()) {
      throw new Error("Betting closed — kickoff has already happened.");
    }
    if (!match.oddsHome || !match.oddsDraw || !match.oddsAway) {
      throw new Error("Direction odds aren't ready for this match yet.");
    }
    if (!match.scoreOdds) {
      throw new Error("Score odds aren't ready for this match yet.");
    }

    const directionOdds = Number(
      directionPick === "HOME"
        ? match.oddsHome
        : directionPick === "DRAW"
          ? match.oddsDraw
          : match.oddsAway
    );

    const sKey = scoreKey(predictedHomeScore, predictedAwayScore);
    const scoreOddsRaw = match.scoreOdds[sKey];
    if (!scoreOddsRaw) {
      throw new Error(`No odds cached for score ${sKey}.`);
    }

    // Prevent duplicate bet on this match.
    const [existing] = await tx
      .select({ id: matchBets.id })
      .from(matchBets)
      .where(
        and(
          eq(matchBets.roomId, room.id),
          eq(matchBets.userId, user.id),
          eq(matchBets.matchId, matchId)
        )
      )
      .limit(1);
    if (existing) {
      throw new Error("You already have a bet on this match.");
    }

    const updated = await tx
      .update(users)
      .set({ chips: sql`${users.chips} - ${totalStake}` })
      .where(and(eq(users.id, user.id), sql`${users.chips} >= ${totalStake}`))
      .returning({ id: users.id, chips: users.chips });
    if (updated.length === 0) {
      throw new Error("Not enough chips.");
    }

    await tx.insert(matchBets).values({
      roomId: room.id,
      userId: user.id,
      matchId,
      directionPick,
      predictedHomeScore,
      predictedAwayScore,
      totalStake,
      directionStake,
      scoreStake,
      directionOddsLocked: directionOdds.toFixed(2),
      scoreOddsLocked: scoreOddsRaw.toFixed(2),
    });

    await recordLedger(tx, {
      roomId: room.id,
      userId: user.id,
      delta: -totalStake,
      balanceAfter: updated[0].chips,
      reason: "match_bet_placed",
      refMatchId: matchId,
      note: `Side: ${directionPick} (${directionStake}) · Score: ${match.homeTeam} ${predictedHomeScore}–${predictedAwayScore} ${match.awayTeam} (${scoreStake})`,
    });
  });

  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidatePath(`/r/${room.code}/dashboard`);
}

const removeBetSchema = z.object({
  matchId: z.string().uuid(),
});

/**
 * Cancels the user's bet on a match before kickoff: refunds the full stake
 * back to their chips, deletes the match_bet row, and writes a ledger entry
 * (reason `match_bet_refund`) so the audit trail still shows the activity.
 *
 * Refusing if the match has kicked off / is settled / or no bet exists.
 */
export async function removeMatchBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = removeBetSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid input.");
  const { matchId } = parsed.data;

  await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match) throw new Error("Match not found.");
    if (new Date(match.kickoff).getTime() <= Date.now()) {
      throw new Error("Too late — kickoff has already happened.");
    }
    if (match.status !== "scheduled") {
      throw new Error("This match is no longer open for changes.");
    }

    const [existing] = await tx
      .select()
      .from(matchBets)
      .where(
        and(
          eq(matchBets.roomId, room.id),
          eq(matchBets.userId, user.id),
          eq(matchBets.matchId, matchId)
        )
      )
      .limit(1);
    if (!existing) throw new Error("No bet to remove.");
    if (existing.status !== "open") {
      throw new Error("This bet is already resolved.");
    }

    const refund = existing.totalStake;
    const [updated] = await tx
      .update(users)
      .set({ chips: sql`${users.chips} + ${refund}` })
      .where(eq(users.id, user.id))
      .returning({ chips: users.chips });

    await tx.delete(matchBets).where(eq(matchBets.id, existing.id));

    await recordLedger(tx, {
      roomId: room.id,
      userId: user.id,
      delta: refund,
      balanceAfter: updated.chips,
      reason: "match_bet_refund",
      refMatchId: matchId,
      note: `Removed bet — refund of ${refund} chips`,
    });
  });

  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidatePath(`/r/${room.code}/dashboard`);
}

export async function updateMatchBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = parseBetForm(formData);
  if (!parsed.success) {
    throw new Error(
      "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const {
    matchId,
    directionPick,
    directionStake,
    predictedHomeScore,
    predictedAwayScore,
    scoreStake,
  } = parsed.data;
  const totalStake = directionStake + scoreStake;

  await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match) throw new Error("Match not found.");
    if (new Date(match.kickoff).getTime() <= Date.now()) {
      throw new Error("Betting closed — kickoff has already happened.");
    }
    if (match.status !== "scheduled") {
      throw new Error("This match is no longer open for changes.");
    }
    if (!match.oddsHome || !match.oddsDraw || !match.oddsAway) {
      throw new Error("Direction odds aren't ready for this match yet.");
    }
    if (!match.scoreOdds) {
      throw new Error("Score odds aren't ready for this match yet.");
    }

    const [existing] = await tx
      .select()
      .from(matchBets)
      .where(
        and(
          eq(matchBets.roomId, room.id),
          eq(matchBets.userId, user.id),
          eq(matchBets.matchId, matchId)
        )
      )
      .limit(1);
    if (!existing) {
      throw new Error("No existing bet to update.");
    }
    if (existing.status !== "open") {
      throw new Error("This bet is already settled.");
    }

    const directionOdds = Number(
      directionPick === "HOME"
        ? match.oddsHome
        : directionPick === "DRAW"
          ? match.oddsDraw
          : match.oddsAway
    );
    const sKey = scoreKey(predictedHomeScore, predictedAwayScore);
    const scoreOddsRaw = match.scoreOdds[sKey];
    if (!scoreOddsRaw) {
      throw new Error(`No odds cached for score ${sKey}.`);
    }

    // Net chip movement = newStake - oldStake. If positive we deduct (and
    // verify funds); if negative we credit back; if zero nothing moves.
    const delta = totalStake - existing.totalStake;
    let newBalance = user.chips;
    if (delta > 0) {
      const updated = await tx
        .update(users)
        .set({ chips: sql`${users.chips} - ${delta}` })
        .where(and(eq(users.id, user.id), sql`${users.chips} >= ${delta}`))
        .returning({ chips: users.chips });
      if (updated.length === 0) {
        throw new Error("Not enough chips for the larger stake.");
      }
      newBalance = updated[0].chips;
    } else if (delta < 0) {
      const refund = -delta;
      const [updated] = await tx
        .update(users)
        .set({ chips: sql`${users.chips} + ${refund}` })
        .where(eq(users.id, user.id))
        .returning({ chips: users.chips });
      newBalance = updated.chips;
    }

    await tx
      .update(matchBets)
      .set({
        directionPick,
        predictedHomeScore,
        predictedAwayScore,
        totalStake,
        directionStake,
        scoreStake,
        directionOddsLocked: directionOdds.toFixed(2),
        scoreOddsLocked: scoreOddsRaw.toFixed(2),
      })
      .where(eq(matchBets.id, existing.id));

    if (delta !== 0) {
      await recordLedger(tx, {
        roomId: room.id,
        userId: user.id,
        delta: -delta,
        balanceAfter: newBalance,
        reason: "match_bet_placed",
        refMatchId: matchId,
        note: `Updated bet — Side: ${directionPick} (${directionStake}) · Score: ${match.homeTeam} ${predictedHomeScore}–${predictedAwayScore} ${match.awayTeam} (${scoreStake})`,
      });
    }
  });

  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidatePath(`/r/${room.code}/dashboard`);
}
