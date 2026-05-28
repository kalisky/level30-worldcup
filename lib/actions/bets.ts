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
  SCORE_RANGE,
} from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";

const placeBetSchema = z.object({
  matchId: z.string().uuid(),
  predictedHomeScore: z.number().int().min(0).max(SCORE_RANGE - 1),
  predictedAwayScore: z.number().int().min(0).max(SCORE_RANGE - 1),
  totalStake: z.number().int().min(2),
});

export async function placeMatchBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = placeBetSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    predictedHomeScore: Number(formData.get("predictedHomeScore") ?? -1),
    predictedAwayScore: Number(formData.get("predictedAwayScore") ?? -1),
    totalStake: Number(formData.get("totalStake") ?? 0),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const { matchId, predictedHomeScore, predictedAwayScore, totalStake } = parsed.data;

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

    const directionPick: "HOME" | "DRAW" | "AWAY" =
      predictedHomeScore > predictedAwayScore
        ? "HOME"
        : predictedAwayScore > predictedHomeScore
          ? "AWAY"
          : "DRAW";
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

    const directionStake = Math.floor(totalStake / 2);
    const scoreStakeAmount = totalStake - directionStake;

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
      .returning({ id: users.id });
    if (updated.length === 0) {
      throw new Error("Not enough chips.");
    }

    await tx.insert(matchBets).values({
      roomId: room.id,
      userId: user.id,
      matchId,
      predictedHomeScore,
      predictedAwayScore,
      totalStake,
      directionStake,
      scoreStake: scoreStakeAmount,
      directionOddsLocked: directionOdds.toFixed(2),
      scoreOddsLocked: scoreOddsRaw.toFixed(2),
    });
  });

  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidatePath(`/r/${room.code}/dashboard`);
}
