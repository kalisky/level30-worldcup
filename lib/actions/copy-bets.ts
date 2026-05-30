"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { matchBets, matches, rooms, users } from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";
import { normalizeRoomCode } from "@/lib/code";
import { recordLedger } from "@/lib/ledger";

/**
 * Result for a single source bet considered for copying. `status` says what
 * the preview / copy decided. For preview, `copy` and other future-tense
 * codes mean "would be copied"; for the live copy, the same codes mean
 * "was copied" or "would have been copied but failed".
 */
export type CopyBetItem = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  totalStake: number;
  directionOddsLocked: number;
  scoreOddsLocked: number;
  status:
    | "copy" // copyable
    | "skip_already_bet"
    | "skip_kickoff_past"
    | "skip_no_odds"
    | "skip_match_settled";
};

export type CopyBetsPreview = {
  sourceRoomCode: string;
  sourceRoomName: string;
  targetRoomCode: string;
  targetChips: number;
  items: CopyBetItem[];
  totalCopyableStake: number;
  copyableCount: number;
  skippedCount: number;
};

const previewSchema = z.object({
  targetRoomCode: z.string().trim().min(1),
  sourceRoomCode: z.string().trim().min(1),
});

async function buildPreview(
  targetRoomCode: string,
  rawSourceRoomCode: string
): Promise<CopyBetsPreview> {
  const sourceRoomCode = normalizeRoomCode(rawSourceRoomCode);
  const { room: targetRoom, user: targetUser } = await requireRoomUser(targetRoomCode);

  if (sourceRoomCode === targetRoom.code) {
    throw new Error("Source and target rooms are the same.");
  }

  // Verify the authUser has membership in the source room.
  const [sourceMembership] = await db
    .select({ room: rooms, user: users })
    .from(users)
    .innerJoin(rooms, eq(rooms.id, users.roomId))
    .where(
      and(
        eq(rooms.code, sourceRoomCode),
        eq(users.authUserId, targetUser.authUserId!)
      )
    )
    .limit(1);
  if (!sourceMembership) {
    throw new Error("You are not a member of that room.");
  }

  // Fetch source bets joined with match info.
  const sourceBets = await db
    .select({ bet: matchBets, match: matches })
    .from(matchBets)
    .innerJoin(matches, eq(matches.id, matchBets.matchId))
    .where(
      and(
        eq(matchBets.roomId, sourceMembership.room.id),
        eq(matchBets.userId, sourceMembership.user.id)
      )
    );

  // For each source bet, check whether it can be copied into the target room.
  const items: CopyBetItem[] = [];
  const now = Date.now();
  for (const { bet, match } of sourceBets) {
    let status: CopyBetItem["status"] = "copy";
    if (match.status === "final") {
      status = "skip_match_settled";
    } else if (new Date(match.kickoff).getTime() <= now) {
      status = "skip_kickoff_past";
    } else if (!match.oddsHome || !match.oddsDraw || !match.oddsAway || !match.scoreOdds) {
      status = "skip_no_odds";
    } else {
      // Check existing bet in target.
      const [existing] = await db
        .select({ id: matchBets.id })
        .from(matchBets)
        .where(
          and(
            eq(matchBets.roomId, targetRoom.id),
            eq(matchBets.userId, targetUser.id),
            eq(matchBets.matchId, bet.matchId)
          )
        )
        .limit(1);
      if (existing) status = "skip_already_bet";
    }

    items.push({
      matchId: bet.matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoff: new Date(match.kickoff).toISOString(),
      predictedHomeScore: bet.predictedHomeScore,
      predictedAwayScore: bet.predictedAwayScore,
      totalStake: bet.totalStake,
      directionOddsLocked: Number(bet.directionOddsLocked),
      scoreOddsLocked: Number(bet.scoreOddsLocked),
      status,
    });
  }

  // Sort: copyable first, then by kickoff.
  items.sort((a, b) => {
    if (a.status === "copy" && b.status !== "copy") return -1;
    if (b.status === "copy" && a.status !== "copy") return 1;
    return a.kickoff.localeCompare(b.kickoff);
  });

  const copyable = items.filter((i) => i.status === "copy");
  return {
    sourceRoomCode: sourceMembership.room.code,
    sourceRoomName: sourceMembership.room.name,
    targetRoomCode: targetRoom.code,
    targetChips: targetUser.chips,
    items,
    copyableCount: copyable.length,
    skippedCount: items.length - copyable.length,
    totalCopyableStake: copyable.reduce((sum, i) => sum + i.totalStake, 0),
  };
}

export async function previewCopyMatchBets(input: {
  targetRoomCode: string;
  sourceRoomCode: string;
}): Promise<CopyBetsPreview> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input.");
  return buildPreview(parsed.data.targetRoomCode, parsed.data.sourceRoomCode);
}

export type CopyBetsResult = {
  copied: number;
  skippedAlreadyBet: number;
  skippedKickoffPast: number;
  skippedNoOdds: number;
  skippedNotEnoughChips: number;
  skippedMatchSettled: number;
};

export async function copyMatchBets(formData: FormData): Promise<CopyBetsResult> {
  const targetRoomCode = String(formData.get("targetRoomCode") ?? "");
  const sourceRoomCode = String(formData.get("sourceRoomCode") ?? "");
  if (!targetRoomCode || !sourceRoomCode) {
    throw new Error("Missing room codes.");
  }

  // The dialog passes `matchIds` for the subset the user actually selected.
  // If absent, fall back to "copy every copyable item" (back-compat).
  const selectedMatchIds = (formData.getAll("matchIds") as string[]).filter(
    (s) => s.length > 0
  );
  const selectedFilter = selectedMatchIds.length > 0 ? new Set(selectedMatchIds) : null;

  const preview = await buildPreview(targetRoomCode, sourceRoomCode);
  const { room: targetRoom, user: targetUser } = await requireRoomUser(targetRoomCode);

  const result: CopyBetsResult = {
    copied: 0,
    skippedAlreadyBet: 0,
    skippedKickoffPast: 0,
    skippedNoOdds: 0,
    skippedNotEnoughChips: 0,
    skippedMatchSettled: 0,
  };

  for (const item of preview.items) {
    if (item.status !== "copy") {
      // Don't count un-copyable items the user implicitly de-selected by
      // having an explicit selection — they were already non-copyable.
      switch (item.status) {
        case "skip_already_bet":
          result.skippedAlreadyBet++;
          break;
        case "skip_kickoff_past":
          result.skippedKickoffPast++;
          break;
        case "skip_no_odds":
          result.skippedNoOdds++;
          break;
        case "skip_match_settled":
          result.skippedMatchSettled++;
          break;
      }
      continue;
    }

    // Honor the user's explicit selection.
    if (selectedFilter && !selectedFilter.has(item.matchId)) {
      continue;
    }

    // Each bet runs in its own transaction so a chip shortfall on one bet
    // doesn't undo prior successful copies. Bets are processed in preview
    // order (copyable, sorted by kickoff).
    try {
      await db.transaction(async (tx) => {
        // Re-check inside the tx — odds may have been regenerated or a bet
        // may have been placed concurrently.
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, item.matchId))
          .limit(1);
        if (!match) throw new Error("vanished");
        if (
          match.status === "final" ||
          new Date(match.kickoff).getTime() <= Date.now()
        ) {
          throw new Error("kickoff_past");
        }
        if (!match.oddsHome || !match.oddsDraw || !match.oddsAway || !match.scoreOdds) {
          throw new Error("no_odds");
        }

        const [existing] = await tx
          .select({ id: matchBets.id })
          .from(matchBets)
          .where(
            and(
              eq(matchBets.roomId, targetRoom.id),
              eq(matchBets.userId, targetUser.id),
              eq(matchBets.matchId, item.matchId)
            )
          )
          .limit(1);
        if (existing) throw new Error("already_bet");

        // Use the target room's current odds, not the source-locked ones.
        const directionPick: "HOME" | "DRAW" | "AWAY" =
          item.predictedHomeScore > item.predictedAwayScore
            ? "HOME"
            : item.predictedAwayScore > item.predictedHomeScore
              ? "AWAY"
              : "DRAW";
        const directionOdds = Number(
          directionPick === "HOME"
            ? match.oddsHome
            : directionPick === "DRAW"
              ? match.oddsDraw
              : match.oddsAway
        );
        const scoreKey = `${item.predictedHomeScore}-${item.predictedAwayScore}`;
        const cache = match.scoreOdds as Record<string, number>;
        const scoreOdd = cache[scoreKey];
        if (!scoreOdd) throw new Error("no_odds");

        const directionStake = Math.floor(item.totalStake / 2);
        const scoreStake = item.totalStake - directionStake;

        const updated = await tx
          .update(users)
          .set({ chips: sql`${users.chips} - ${item.totalStake}` })
          .where(
            and(eq(users.id, targetUser.id), sql`${users.chips} >= ${item.totalStake}`)
          )
          .returning({ chips: users.chips });
        if (updated.length === 0) throw new Error("not_enough_chips");

        await tx.insert(matchBets).values({
          roomId: targetRoom.id,
          userId: targetUser.id,
          matchId: item.matchId,
          predictedHomeScore: item.predictedHomeScore,
          predictedAwayScore: item.predictedAwayScore,
          totalStake: item.totalStake,
          directionStake,
          scoreStake,
          directionOddsLocked: directionOdds.toFixed(2),
          scoreOddsLocked: scoreOdd.toFixed(2),
        });

        await recordLedger(tx, {
          roomId: targetRoom.id,
          userId: targetUser.id,
          delta: -item.totalStake,
          balanceAfter: updated[0].chips,
          reason: "match_bet_placed",
          refMatchId: item.matchId,
          note: `Copied from ${preview.sourceRoomName}: ${match.homeTeam} ${item.predictedHomeScore}–${item.predictedAwayScore} ${match.awayTeam}`,
        });
      });
      result.copied++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "not_enough_chips") result.skippedNotEnoughChips++;
      else if (msg === "kickoff_past") result.skippedKickoffPast++;
      else if (msg === "no_odds") result.skippedNoOdds++;
      else if (msg === "already_bet") result.skippedAlreadyBet++;
      else result.skippedNoOdds++; // fallback bucket
    }
  }

  revalidatePath(`/r/${targetRoom.code}/dashboard`);
  return result;
}
