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
import { isKnockout } from "@/lib/knockout";
import { listRoomsForAuthUser } from "@/lib/db/queries";
import { recordLedger } from "@/lib/ledger";
import { touchRoomLiveRevision } from "@/lib/live-updates";
import { revalidateRoomChipPaths } from "@/lib/revalidate-room-chip-paths";
import type { Match } from "@/lib/db/schema";

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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DesiredBet = {
  directionPick: "HOME" | "DRAW" | "AWAY" | null;
  directionStake: number;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  scoreStake: number;
};

/**
 * Applies the user's complete desired bet state for one match within a single
 * room, inside the given transaction: create, update, or clear-with-refund.
 * Shared by the direct quick-bet path and the "apply to all my rooms" mirror
 * so every room goes through identical create/refund/ledger logic.
 *
 * `match` is passed in (it's global across rooms) and re-validated as open so
 * a mirror into another room can't slip a bet onto a match that just kicked
 * off. `recordDefaults` is true only for the room the user actually acted in.
 */
async function applyDesiredMatchBetTx(
  tx: Tx,
  args: {
    roomId: string;
    userId: string;
    match: Match;
    desired: DesiredBet;
    recordDefaults: boolean;
  }
) {
  const { roomId, userId, match, desired } = args;
  const { directionPick, directionStake, predictedHomeScore, predictedAwayScore, scoreStake } =
    desired;
  const knockout = isKnockout(match.groupLabel);

  if (new Date(match.kickoff).getTime() <= Date.now()) {
    throw new Error("Betting closed — kickoff has already happened.");
  }
  if (match.status !== "scheduled") {
    throw new Error("This match is no longer open for changes.");
  }
  if (knockout && directionPick === "DRAW") {
    throw new Error("Knockout matches have no draw — pick which team advances.");
  }

  const hasDirection = directionPick !== null && directionStake > 0;
  const hasScore =
    predictedHomeScore !== null && predictedAwayScore !== null && scoreStake > 0;

  const [existing] = await tx
    .select()
    .from(matchBets)
    .where(
      and(
        eq(matchBets.roomId, roomId),
        eq(matchBets.userId, userId),
        eq(matchBets.matchId, match.id)
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
      .where(eq(users.id, userId))
      .returning({ chips: users.chips });
    await tx.delete(matchBets).where(eq(matchBets.id, existing.id));
    await recordLedger(tx, {
      roomId,
      userId,
      delta: refund,
      balanceAfter: updated.chips,
      reason: "match_bet_refund",
      refMatchId: match.id,
      note: `Removed bet — refund of ${refund} chips`,
    });
    await touchRoomLiveRevision(tx, roomId);
    return;
  }

  // Knockout is a 2-way (advance) market, so there's no draw odds to require.
  const directionOddsReady = knockout
    ? !!match.oddsHome && !!match.oddsAway
    : !!match.oddsHome && !!match.oddsDraw && !!match.oddsAway;
  if (!directionOddsReady) {
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
  // sensible placeholders (stake 0 keeps them out of settlement). Knockout
  // never stores DRAW — fall back to the higher predicted side (HOME on a tie).
  const storedPick: "HOME" | "DRAW" | "AWAY" =
    directionPick ??
    (predictedHomeScore! > predictedAwayScore!
      ? "HOME"
      : predictedAwayScore! > predictedHomeScore!
        ? "AWAY"
        : knockout
          ? "HOME"
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
  let newBalance = 0;
  if (delta > 0) {
    const updated = await tx
      .update(users)
      .set({ chips: sql`${users.chips} - ${delta}` })
      .where(and(eq(users.id, userId), sql`${users.chips} >= ${delta}`))
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
      .where(eq(users.id, userId))
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
      roomId,
      userId,
      matchId: match.id,
      ...values,
    });
  }

  if (delta !== 0) {
    await recordLedger(tx, {
      roomId,
      userId,
      delta: -delta,
      balanceAfter: newBalance,
      reason: "match_bet_placed",
      refMatchId: match.id,
      note: `${existing ? "Updated" : "Placed"} bet — ${
        hasDirection ? `Side: ${storedPick} (${effDirectionStake})` : "no side bet"
      } · ${
        hasScore
          ? `Score: ${match.homeTeam} ${storedHome}–${storedAway} ${match.awayTeam} (${effScoreStake})`
          : "no score bet"
      }`,
    });
  }

  // Remember the stakes as the user's defaults for their next quick bet —
  // only for the room the user actually acted in, not mirrored rooms.
  if (args.recordDefaults) {
    const defaults: Partial<{ defaultDirectionStake: number; defaultScoreStake: number }> = {};
    if (hasDirection) defaults.defaultDirectionStake = directionStake;
    if (hasScore) defaults.defaultScoreStake = scoreStake;
    if (Object.keys(defaults).length > 0) {
      await tx.update(users).set(defaults).where(eq(users.id, userId));
    }
  }

  await touchRoomLiveRevision(tx, roomId);
}

export type QuickSetResult = {
  // Rooms the bet was also mirrored into (excludes the room acted in).
  mirroredRooms: number;
  // Rooms that couldn't be synced, with a short reason for a UI notice.
  failedRooms: { name: string; reason: string }[];
};

function mirrorFailureReason(message: string): string {
  if (message.includes("Not enough chips")) return "not enough chips";
  if (message.includes("odds")) return "odds not ready";
  return "couldn't sync";
}

export async function quickSetMatchBet(formData: FormData): Promise<QuickSetResult> {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const rawPick = String(formData.get("directionPick") ?? "");
  const applyToAllRooms = String(formData.get("applyToAllRooms") ?? "") === "1";
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

  const desired: DesiredBet = {
    directionPick,
    directionStake,
    predictedHomeScore,
    predictedAwayScore,
    scoreStake,
  };

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) throw new Error("Match not found.");

  // Primary room first. If this throws (e.g. not enough chips), the whole
  // action fails and nothing is mirrored — the user's own room is the source
  // of truth for whether the bet is valid.
  await db.transaction((tx) =>
    applyDesiredMatchBetTx(tx, {
      roomId: room.id,
      userId: user.id,
      match,
      desired,
      recordDefaults: true,
    })
  );
  revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidateRoomChipPaths(room.code);

  const result: QuickSetResult = { mirroredRooms: 0, failedRooms: [] };

  // Mirror into the user's other rooms, best-effort: each runs in its own
  // transaction so a shortfall in one room doesn't roll back the others or
  // the primary save.
  if (applyToAllRooms && user.authUserId) {
    const memberships = await listRoomsForAuthUser(user.authUserId);
    const others = memberships.filter((m) => m.room.id !== room.id);
    for (const m of others) {
      try {
        await db.transaction((tx) =>
          applyDesiredMatchBetTx(tx, {
            roomId: m.room.id,
            userId: m.membership.id,
            match,
            desired,
            recordDefaults: false,
          })
        );
        result.mirroredRooms += 1;
        revalidatePath(`/r/${m.room.code}/match/${matchId}`);
        revalidateRoomChipPaths(m.room.code);
      } catch (e) {
        result.failedRooms.push({
          name: m.room.name,
          reason: mirrorFailureReason(e instanceof Error ? e.message : ""),
        });
      }
    }
  }

  return result;
}
