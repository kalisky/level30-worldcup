"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  customBets,
  customWagers,
  matches,
  settlements,
  users,
  type CustomBetOption,
} from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";
import {
  findOptionIdxByAnswer,
  stampCustomBetOption,
} from "@/lib/custom-bet-odds";
import { recordLedger } from "@/lib/ledger";
import {
  touchMatchLiveRevisions,
  touchRoomLiveRevision,
} from "@/lib/live-updates";
import { revalidateOddsSyncPaths } from "@/lib/odds-sync/revalidate";
import { syncMatchOdds } from "@/lib/odds-sync/service";
import {
  suggestCustomBetWinner as aiSuggestCustomBetWinner,
  type SuggestedCustomBetWinner,
} from "@/lib/ai/suggest";
import { revalidateRoomChipPaths } from "@/lib/revalidate-room-chip-paths";

// Match settlement is server-side only — see lib/auto-settle.ts. Users
// never settle matches; they only resolve custom bets below.

const settleCustomSchema = z
  .object({
    customBetId: z.string().uuid(),
    winningOptionIdx: z.preprocess((value) => {
      if (value == null || value === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }, z.number().int().nonnegative().optional()),
    winningAnswer: z.preprocess((value) => {
      if (value == null) return undefined;
      const text = String(value).trim();
      return text.length > 0 ? text : undefined;
    }, z.string().max(80).optional()),
  })
  .refine(
    (data) => data.winningOptionIdx != null || data.winningAnswer != null,
    { message: "Invalid choice." }
  );

export async function settleCustomBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = settleCustomSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
    winningOptionIdx: formData.get("winningOptionIdx"),
    winningAnswer: formData.get("winningAnswer"),
  });
  if (!parsed.success) throw new Error("Invalid choice.");
  const { customBetId, winningAnswer } = parsed.data;

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Bet not found.");
    if (bet.roomId !== room.id) throw new Error("Not your room.");
    if (bet.status === "settled" || bet.status === "void") {
      throw new Error("Already resolved.");
    }
    if (bet.kind !== "open_question" && winningAnswer) {
      throw new Error("Only open-question bets can be settled with a typed answer.");
    }

    let winningOptionIdx = parsed.data.winningOptionIdx ?? null;
    let options = [...(bet.options as CustomBetOption[])];

    if (bet.kind === "open_question" && winningAnswer) {
      const existingIdx = findOptionIdxByAnswer(options, winningAnswer);
      if (existingIdx >= 0) {
        winningOptionIdx = existingIdx;
      } else {
        options.push(
          stampCustomBetOption({
            label: winningAnswer,
            probability: 0,
            odds: 0,
          })
        );
        winningOptionIdx = options.length - 1;
      }
    }

    if (winningOptionIdx == null || winningOptionIdx >= options.length) {
      throw new Error("Invalid option.");
    }

    // An ad-hoc bet is only "valid" with at least 2 different wagerers —
    // otherwise there's no real opposition. If under-participated, the admin
    // should void & refund instead of settling.
    const distinct = await tx
      .selectDistinct({ userId: customWagers.userId })
      .from(customWagers)
      .where(eq(customWagers.customBetId, customBetId));
    if (distinct.length < 2) {
      throw new Error(
        `This bet needs at least 2 different wagerers before it can be settled (currently ${distinct.length}). Use "Void & refund" instead.`
      );
    }

    await tx
      .update(customBets)
      .set({ status: "settled", winningOptionIdx, options })
      .where(eq(customBets.id, customBetId));

    const openWagers = await tx
      .select()
      .from(customWagers)
      .where(
        and(eq(customWagers.customBetId, customBetId), eq(customWagers.status, "open"))
      );

    for (const w of openWagers) {
      const won = w.optionIdx === winningOptionIdx;
      if (won) {
        const payout = Math.ceil(w.stake * Number(w.oddsLocked));
        const [updatedUser] = await tx
          .update(users)
          .set({ chips: sql`${users.chips} + ${payout}` })
          .where(eq(users.id, w.userId))
          .returning({ chips: users.chips });
        await recordLedger(tx, {
          roomId: room.id,
          userId: w.userId,
          delta: payout,
          balanceAfter: updatedUser.chips,
          reason: "custom_wager_payout",
          refCustomBetId: customBetId,
          note: `Won "${options[winningOptionIdx]?.label}" on "${bet.title}"`,
        });
      }
      await tx
        .update(customWagers)
        .set({ status: won ? "won" : "lost" })
        .where(eq(customWagers.id, w.id));
    }

    await tx.insert(settlements).values({
      roomId: room.id,
      actorId: user.id,
      kind: "custom_bet",
      targetId: customBetId,
      payload: {
        winningOptionIdx,
        winningLabel: options[winningOptionIdx]?.label,
        wagersSettled: openWagers.length,
      },
    });

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/admin`);
  revalidateRoomChipPaths(room.code);
}

export async function voidCustomBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);
  const customBetId = String(formData.get("customBetId") ?? "");
  if (!customBetId) throw new Error("Missing bet id.");

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Bet not found.");
    if (bet.roomId !== room.id) throw new Error("Not your room.");
    if (bet.status === "settled" || bet.status === "void") {
      throw new Error("Already resolved.");
    }

    await tx
      .update(customBets)
      .set({ status: "void" })
      .where(eq(customBets.id, customBetId));

    const openWagers = await tx
      .select()
      .from(customWagers)
      .where(
        and(eq(customWagers.customBetId, customBetId), eq(customWagers.status, "open"))
      );

    for (const w of openWagers) {
      const [updatedUser] = await tx
        .update(users)
        .set({ chips: sql`${users.chips} + ${w.stake}` })
        .where(eq(users.id, w.userId))
        .returning({ chips: users.chips });
      await recordLedger(tx, {
        roomId: room.id,
        userId: w.userId,
        delta: w.stake,
        balanceAfter: updatedUser.chips,
        reason: "custom_wager_refund",
        refCustomBetId: customBetId,
        note: `Refund — "${bet.title}" was voided`,
      });
      await tx
        .update(customWagers)
        .set({ status: "void" })
        .where(eq(customWagers.id, w.id));
    }

    await tx.insert(settlements).values({
      roomId: room.id,
      actorId: user.id,
      kind: "void_custom_bet",
      targetId: customBetId,
      payload: { refundedWagers: openWagers.length },
    });

    await touchRoomLiveRevision(tx, room.id);
  });

  revalidatePath(`/r/${room.code}/admin`);
  revalidateRoomChipPaths(room.code);
}

const renameSchema = z.object({
  matchId: z.string().uuid(),
  homeTeam: z.string().trim().min(1).max(40),
  awayTeam: z.string().trim().min(1).max(40),
});

export async function renameMatchTeams(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  await requireRoomUser(code);
  const parsed = renameSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    homeTeam: String(formData.get("homeTeam") ?? ""),
    awayTeam: String(formData.get("awayTeam") ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid team names.");
  const { matchId, homeTeam, awayTeam } = parsed.data;

  // Reset odds (both direction + score cache) so they get regenerated.
  await db
    .update(matches)
    .set({
      homeTeam,
      awayTeam,
      oddsHome: null,
      oddsDraw: null,
      oddsAway: null,
      scoreOdds: null,
      oddsSourceWinnerUrl: null,
      oddsSourceCorrectScoreUrl: null,
      oddsLastSyncedAt: null,
      oddsLastSyncStatus: null,
      oddsLastSyncError: null,
    })
    .where(eq(matches.id, matchId));

  await touchMatchLiveRevisions(db, matchId);

  revalidatePath(`/r/${code}/admin`);
  revalidatePath(`/r/${code}/match/${matchId}`);
}

export async function suggestCustomBetWinner(formData: FormData): Promise<SuggestedCustomBetWinner> {
  const code = String(formData.get("roomCode") ?? "");
  await requireRoomUser(code);
  const customBetId = String(formData.get("customBetId") ?? "");
  if (!customBetId) throw new Error("Missing bet id.");

  const [bet] = await db.select().from(customBets).where(eq(customBets.id, customBetId)).limit(1);
  if (!bet) throw new Error("Bet not found.");

  let match = null;
  if (bet.matchId) {
    const [m] = await db.select().from(matches).where(eq(matches.id, bet.matchId)).limit(1);
    match = m ?? null;
  }
  return aiSuggestCustomBetWinner({ bet, match });
}

export async function regenerateMatchOdds(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  await requireRoomUser(code);
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) throw new Error("Missing match id.");

  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) throw new Error("Match not found.");
  if (m.status === "final") throw new Error("Cannot regenerate odds for a final match.");

  const result = await syncMatchOdds({
    force: true,
    matchId,
    trigger: "admin",
  });
  if (result.status === "error") {
    throw new Error(result.summary);
  }

  revalidateOddsSyncPaths();
  revalidatePath(`/r/${code}/admin`);
  revalidatePath(`/r/${code}/match/${matchId}`);
}
