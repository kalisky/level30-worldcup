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
import { touchRoomLiveRevision } from "@/lib/live-updates";
import { revalidateRoomChipPaths } from "@/lib/revalidate-room-chip-paths";

// Quick-bet upsert: the client sends its complete desired bet state on every
// interaction (tap a side, step a score, tweak a stake) and the server makes
// the row match it — create, update, or delete-with-refund. No confirm step.
// A part is "active" when it has both a selection and a positive stake;
// inactive parts are stored with stake 0 so the single-row bet model and
// settlement logic stay unchanged.
const quickSetSchema = z
  .object({
    matchId: z.string().uuid(),
    directionPick: z.enum(["HOME", "DRAW", "AWAY"]).nullable(),
    directionStake: z.number().int().min(0),
    predictedHomeScore: z.number().int().min(0).max(99).nullable(),
    predictedAwayScore: z.number().int().min(0).max(99).nullable(),
    scoreStake: z.number().int().min(0),
  })
  .refine(
    (d) => (d.predictedHomeScore === null) === (d.predictedAwayScore === null),
    { message: "Score prediction must include both sides." }
  );

function optionalNumber(value: FormDataEntryValue | null) {
  const s = String(value ?? "");
  return s === "" ? null : Number(s);
}

export async function quickSetMatchBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const rawPick = String(formData.get("directionPick") ?? "");
  const parsed = quickSetSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    directionPick: rawPick === "" ? null : rawPick,
    directionStake: Number(formData.get("directionStake") ?? 0),
    predictedHomeScore: optionalNumber(formData.get("predictedHomeScore")),
    predictedAwayScore: optionalNumber(formData.get("predictedAwayScore")),
    scoreStake: Number(formData.get("scoreStake") ?? 0),
  });
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

  const hasDirection = directionPick !== null && directionStake > 0;
  const hasScore =
    predictedHomeScore !== null && predictedAwayScore !== null && scoreStake > 0;

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
    if (existing && existing.status !== "open") {
      throw new Error("This bet is already resolved.");
    }

    // Everything toggled off → clear the bet and refund.
    if (!hasDirection && !hasScore) {
      if (!existing) return;
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
      await touchRoomLiveRevision(tx, room.id);
      return;
    }

    if (!match.oddsHome || !match.oddsDraw || !match.oddsAway) {
      throw new Error("Direction odds aren't ready for this match yet.");
    }
    if (!match.scoreOdds) {
      throw new Error("Score odds aren't ready for this match yet.");
    }

    const effDirectionStake = hasDirection ? directionStake : 0;
    const effScoreStake = hasScore ? scoreStake : 0;
    const totalStake = effDirectionStake + effScoreStake;
    if (totalStake < 2) {
      throw new Error("Total stake must be at least 2 chips.");
    }

    // The row requires a pick and a score even for inactive parts; derive
    // sensible placeholders (stake 0 keeps them out of settlement).
    const storedPick: "HOME" | "DRAW" | "AWAY" =
      directionPick ??
      (predictedHomeScore! > predictedAwayScore!
        ? "HOME"
        : predictedAwayScore! > predictedHomeScore!
          ? "AWAY"
          : "DRAW");
    const storedHome = hasScore ? predictedHomeScore! : 0;
    const storedAway = hasScore ? predictedAwayScore! : 0;

    const directionOdds = Number(
      storedPick === "HOME"
        ? match.oddsHome
        : storedPick === "DRAW"
          ? match.oddsDraw
          : match.oddsAway
    );

    const sKey = scoreKey(storedHome, storedAway);
    const scoreOddsRaw = match.scoreOdds[sKey];
    if (hasScore && !scoreOddsRaw) {
      throw new Error(`No odds cached for score ${sKey}.`);
    }

    // Net chip movement = newStake - oldStake. If positive we deduct (and
    // verify funds); if negative we credit back; if zero nothing moves.
    const delta = totalStake - (existing?.totalStake ?? 0);
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

    const values = {
      directionPick: storedPick,
      predictedHomeScore: storedHome,
      predictedAwayScore: storedAway,
      totalStake,
      directionStake: effDirectionStake,
      scoreStake: effScoreStake,
      directionOddsLocked: directionOdds.toFixed(2),
      scoreOddsLocked: (scoreOddsRaw ? Number(scoreOddsRaw) : 1).toFixed(2),
    };
    if (existing) {
      await tx.update(matchBets).set(values).where(eq(matchBets.id, existing.id));
    } else {
      await tx.insert(matchBets).values({
        roomId: room.id,
        userId: user.id,
        matchId,
        ...values,
      });
    }

    if (delta !== 0) {
      await recordLedger(tx, {
        roomId: room.id,
        userId: user.id,
        delta: -delta,
        balanceAfter: newBalance,
        reason: "match_bet_placed",
        refMatchId: matchId,
        note: `${existing ? "Updated" : "Placed"} bet — ${
          hasDirection ? `Side: ${storedPick} (${effDirectionStake})` : "no side bet"
        } · ${
          hasScore
            ? `Score: ${match.homeTeam} ${storedHome}–${storedAway} ${match.awayTeam} (${effScoreStake})`
            : "no score bet"
        }`,
      });
    }

    // Remember the stakes as the user's defaults for their next quick bet.
    const defaults: Partial<{ defaultDirectionStake: number; defaultScoreStake: number }> = {};
    if (hasDirection) defaults.defaultDirectionStake = directionStake;
    if (hasScore) defaults.defaultScoreStake = scoreStake;
    if (Object.keys(defaults).length > 0) {
      await tx.update(users).set(defaults).where(eq(users.id, user.id));
    }

    await touchRoomLiveRevision(tx, room.id);
  });

  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidateRoomChipPaths(room.code);
}
