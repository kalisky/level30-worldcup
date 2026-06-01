"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  customBets,
  customWagers,
  users,
  type CustomBetOption,
} from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";
import {
  generateCustomBetOdds,
  generateOpenAnswerOdds,
} from "@/lib/ai/odds";
import {
  ensureFreshCustomBetOdds,
  findOptionIdxByAnswer,
  getCustomBetMatchContext,
  stampCustomBetOption,
  stampCustomBetOptions,
} from "@/lib/custom-bet-odds";
import { recordLedger } from "@/lib/ledger";
import { touchRoomLiveRevision } from "@/lib/live-updates";

const baseProposeSchema = z.object({
  matchId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).default(""),
  locksAtIso: z.string().trim().min(1),
});

const MAX_CUSTOM_BETS_PER_USER_PER_DAY = 10;
const MAX_CUSTOM_BETS_PER_ROOM_PER_DAY = 100;

const fixedProposeSchema = baseProposeSchema.extend({
  kind: z.literal("fixed_options"),
  optionLabels: z.array(z.string().trim().min(1).max(50)).min(2).max(5),
});

const openProposeSchema = baseProposeSchema.extend({
  kind: z.literal("open_question"),
});

export async function proposeCustomBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const matchIdRaw = String(formData.get("matchId") ?? "").trim();
  const matchId = matchIdRaw || undefined;
  const kindRaw = String(formData.get("kind") ?? "fixed_options");

  const base = {
    matchId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    locksAtIso: String(formData.get("locksAt") ?? ""),
  };

  let kind: "fixed_options" | "open_question";
  let optionLabels: string[] = [];
  if (kindRaw === "open_question") {
    const parsed = openProposeSchema.safeParse({ ...base, kind: "open_question" });
    if (!parsed.success) {
      throw new Error(
        "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
      );
    }
    kind = "open_question";
  } else {
    const optionLabelsRaw = (formData.getAll("optionLabels") as string[])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const parsed = fixedProposeSchema.safeParse({
      ...base,
      kind: "fixed_options",
      optionLabels: optionLabelsRaw,
    });
    if (!parsed.success) {
      throw new Error(
        "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
      );
    }
    kind = "fixed_options";
    optionLabels = parsed.data.optionLabels;
  }

  const locksAt = new Date(base.locksAtIso);
  if (Number.isNaN(locksAt.getTime())) throw new Error("Invalid lock time.");
  if (locksAt.getTime() <= Date.now()) {
    throw new Error("Lock time must be in the future.");
  }

  // Quotas — exclude seeded defaults (defaultKey set) so they don't burn the
  // creator's first two slots when a room is opened.
  const [userQuota] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customBets)
    .where(
      and(
        eq(customBets.proposerId, user.id),
        sql`${customBets.defaultKey} IS NULL`,
        sql`${customBets.createdAt} > now() - interval '24 hours'`
      )
    );
  if ((userQuota?.n ?? 0) >= MAX_CUSTOM_BETS_PER_USER_PER_DAY) {
    throw new Error(
      `You've reached your daily limit of ${MAX_CUSTOM_BETS_PER_USER_PER_DAY} custom bets. Try again tomorrow.`
    );
  }

  const [roomQuota] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customBets)
    .where(
      and(
        eq(customBets.roomId, room.id),
        sql`${customBets.defaultKey} IS NULL`,
        sql`${customBets.createdAt} > now() - interval '24 hours'`
      )
    );
  if ((roomQuota?.n ?? 0) >= MAX_CUSTOM_BETS_PER_ROOM_PER_DAY) {
    throw new Error(
      `This room has reached its daily limit of ${MAX_CUSTOM_BETS_PER_ROOM_PER_DAY} custom bets. Try again tomorrow.`
    );
  }

  const matchContext = await getCustomBetMatchContext(matchId, db, {
    requireMatch: Boolean(matchId),
    requireNonFinal: true,
  });

  let options: CustomBetOption[] = [];
  let aiReasoning = "";
  if (kind === "fixed_options") {
    const aiResult = await generateCustomBetOdds({
      matchContext,
      title: base.title,
      description: base.description,
      optionLabels,
    });
    options = stampCustomBetOptions(aiResult.options);
    aiReasoning = aiResult.reasoning;
  }
  // For open_question: options start empty; each new answer adds an entry.

  const [created] = await db
    .insert(customBets)
    .values({
      roomId: room.id,
      matchId: matchId ?? null,
      proposerId: user.id,
      title: base.title,
      description: base.description,
      kind,
      options,
      aiReasoning,
      status: "open",
      locksAt,
    })
    .returning();

  await touchRoomLiveRevision(db, room.id);

  if (matchId) revalidatePath(`/r/${room.code}/match/${matchId}`);
  revalidatePath(`/r/${room.code}/dashboard`);
  revalidatePath(`/r/${room.code}/admin`);

  return { customBetId: created.id };
}

// --- Fixed-options wagering (existing flow) -------------------------------

const wagerSchema = z.object({
  customBetId: z.string().uuid(),
  optionIdx: z.number().int().nonnegative(),
  stake: z.number().int().positive(),
});

export async function placeCustomWager(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = wagerSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
    optionIdx: Number(formData.get("optionIdx") ?? -1),
    stake: Number(formData.get("stake") ?? 0),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid wager: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const { customBetId, optionIdx, stake } = parsed.data;

  const [betPreRaw] = await db
    .select()
    .from(customBets)
    .where(eq(customBets.id, customBetId))
    .limit(1);
  if (!betPreRaw) throw new Error("Custom bet not found.");
  if (betPreRaw.roomId !== room.id) throw new Error("Not your room.");
  await ensureFreshCustomBetOdds(db, betPreRaw);

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Custom bet not found.");
    if (bet.roomId !== room.id) throw new Error("Not your room.");
    if (bet.status !== "open") throw new Error("This bet is no longer open.");
    if (bet.locksAt && new Date(bet.locksAt).getTime() <= Date.now()) {
      throw new Error("This bet has locked.");
    }
    if (optionIdx >= bet.options.length) {
      throw new Error("Invalid option.");
    }

    const [existing] = await tx
      .select({ id: customWagers.id })
      .from(customWagers)
      .where(
        and(
          eq(customWagers.customBetId, customBetId),
          eq(customWagers.userId, user.id)
        )
      )
      .limit(1);
    if (existing) throw new Error("You already wagered on this bet.");

    const odds = bet.options[optionIdx].odds;

    const updated = await tx
      .update(users)
      .set({ chips: sql`${users.chips} - ${stake}` })
      .where(and(eq(users.id, user.id), sql`${users.chips} >= ${stake}`))
      .returning({ id: users.id, chips: users.chips });
    if (updated.length === 0) throw new Error("Not enough chips.");

    await tx.insert(customWagers).values({
      customBetId,
      userId: user.id,
      optionIdx,
      stake,
      oddsLocked: odds.toFixed(2),
    });

    await recordLedger(tx, {
      roomId: room.id,
      userId: user.id,
      delta: -stake,
      balanceAfter: updated[0].chips,
      reason: "custom_wager_placed",
      refCustomBetId: customBetId,
      note: `Wagered ${stake} on "${bet.options[optionIdx].label}" — ${bet.title}`,
    });

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}

const updateWagerSchema = z.object({
  customBetId: z.string().uuid(),
  optionIdx: z.number().int().nonnegative(),
  stake: z.number().int().positive(),
});

export async function updateCustomWager(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = updateWagerSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
    optionIdx: Number(formData.get("optionIdx") ?? -1),
    stake: Number(formData.get("stake") ?? 0),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid wager: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const { customBetId, optionIdx, stake } = parsed.data;

  const [betPreRaw] = await db
    .select()
    .from(customBets)
    .where(eq(customBets.id, customBetId))
    .limit(1);
  if (!betPreRaw) throw new Error("Custom bet not found.");
  if (betPreRaw.roomId !== room.id) throw new Error("Not your room.");
  await ensureFreshCustomBetOdds(db, betPreRaw);

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Custom bet not found.");
    if (bet.roomId !== room.id) throw new Error("Not your room.");
    if (bet.status !== "open") throw new Error("This bet is no longer open.");
    if (bet.locksAt && new Date(bet.locksAt).getTime() <= Date.now()) {
      throw new Error("This bet has locked.");
    }
    if (bet.kind !== "fixed_options") {
      throw new Error("Use updateOpenWager for open-question bets.");
    }
    if (optionIdx >= bet.options.length) throw new Error("Invalid option.");

    const [existing] = await tx
      .select()
      .from(customWagers)
      .where(
        and(
          eq(customWagers.customBetId, customBetId),
          eq(customWagers.userId, user.id)
        )
      )
      .limit(1);
    if (!existing) throw new Error("You don't have a wager on this bet.");
    if (existing.status !== "open") {
      throw new Error("This wager is no longer open.");
    }

    const odds = bet.options[optionIdx].odds;
    const delta = stake - existing.stake;

    let balanceAfter = user.chips;
    if (delta !== 0) {
      const updated = await tx
        .update(users)
        .set({ chips: sql`${users.chips} - ${delta}` })
        .where(
          and(
            eq(users.id, user.id),
            delta > 0 ? sql`${users.chips} >= ${delta}` : sql`true`
          )
        )
        .returning({ chips: users.chips });
      if (updated.length === 0) throw new Error("Not enough chips.");
      balanceAfter = updated[0].chips;
    }

    await tx
      .update(customWagers)
      .set({
        optionIdx,
        stake,
        oddsLocked: odds.toFixed(2),
      })
      .where(eq(customWagers.id, existing.id));

    if (delta !== 0) {
      await recordLedger(tx, {
        roomId: room.id,
        userId: user.id,
        delta: -delta,
        balanceAfter,
        reason: "custom_wager_placed",
        refCustomBetId: customBetId,
        note: `Updated wager to ${stake} on "${bet.options[optionIdx].label}" — ${bet.title}`,
      });
    }

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}

const removeWagerSchema = z.object({
  customBetId: z.string().uuid(),
});

export async function removeCustomWager(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = removeWagerSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid wager.");
  const { customBetId } = parsed.data;

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Custom bet not found.");
    if (bet.roomId !== room.id) throw new Error("Not your room.");
    if (bet.status !== "open") throw new Error("This bet is no longer open.");
    if (bet.locksAt && new Date(bet.locksAt).getTime() <= Date.now()) {
      throw new Error("This bet has locked.");
    }

    const [existing] = await tx
      .select()
      .from(customWagers)
      .where(
        and(
          eq(customWagers.customBetId, customBetId),
          eq(customWagers.userId, user.id)
        )
      )
      .limit(1);
    if (!existing) throw new Error("You don't have a wager on this bet.");
    if (existing.status !== "open") {
      throw new Error("This wager is no longer open.");
    }

    const refund = existing.stake;
    const [updated] = await tx
      .update(users)
      .set({ chips: sql`${users.chips} + ${refund}` })
      .where(eq(users.id, user.id))
      .returning({ chips: users.chips });

    await tx.delete(customWagers).where(eq(customWagers.id, existing.id));

    const optLabel = bet.options[existing.optionIdx]?.label ?? "?";
    await recordLedger(tx, {
      roomId: room.id,
      userId: user.id,
      delta: refund,
      balanceAfter: updated.chips,
      reason: "custom_wager_canceled",
      refCustomBetId: customBetId,
      note: `Removed wager on "${optLabel}" — ${bet.title}`,
    });

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}

// --- Open-question helpers ------------------------------------------------

/**
 * Returns the odds for a specific free-form answer to an open question.
 * If the answer already exists in the bet's options (case-insensitive), the
 * cached odds are returned unless they've gone stale (24h TTL), in which case
 * they are refreshed first. Otherwise Claude/Gemini is consulted for a fresh
 * estimate WITHOUT persisting — pure preview. Wagering with the same answer
 * later will use the same lookup logic; if odds haven't been cached yet by a
 * concurrent wager, a fresh call is made then.
 */
export async function previewOpenAnswerOdds(input: {
  roomCode: string;
  customBetId: string;
  answer: string;
}): Promise<{
  probability: number;
  odds: number;
  reasoning: string;
  isExisting: boolean;
  label: string;
}> {
  const { room } = await requireRoomUser(input.roomCode);
  const answer = input.answer.trim();
  if (answer.length < 1 || answer.length > 80) {
    throw new Error("Answer must be 1–80 characters.");
  }

  const [bet] = await db
    .select()
    .from(customBets)
    .where(eq(customBets.id, input.customBetId))
    .limit(1);
  if (!bet) throw new Error("Custom bet not found.");
  if (bet.roomId !== room.id) throw new Error("Not your room.");
  if (bet.kind !== "open_question") {
    throw new Error("Not an open-question bet.");
  }

  const freshBet = await ensureFreshCustomBetOdds(db, bet);
  const idx = findOptionIdxByAnswer(freshBet.options, answer);
  if (idx >= 0) {
    const opt = freshBet.options[idx];
    return {
      probability: opt.probability,
      odds: opt.odds,
      reasoning: "Cached odds — another player already submitted this answer.",
      isExisting: true,
      label: opt.label,
    };
  }

  const matchContext = await getCustomBetMatchContext(
    freshBet.matchId ?? undefined,
    db,
    { requireMatch: Boolean(freshBet.matchId) }
  );
  const ai = await generateOpenAnswerOdds({
    matchContext,
    title: freshBet.title,
    description: freshBet.description,
    answer,
    existingAnswers: freshBet.options.map((o) => o.label),
  });
  return {
    probability: ai.probability,
    odds: ai.odds,
    reasoning: ai.reasoning,
    isExisting: false,
    label: answer,
  };
}

const openWagerSchema = z.object({
  customBetId: z.string().uuid(),
  answer: z.string().trim().min(1).max(80),
  stake: z.number().int().positive(),
});

export async function placeOpenWager(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = openWagerSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
    answer: String(formData.get("answer") ?? ""),
    stake: Number(formData.get("stake") ?? 0),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid wager: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const { customBetId, answer, stake } = parsed.data;

  // Resolve to an option idx + odds before opening the transaction, since the
  // AI call (if needed) is slow and we don't want to hold a DB lock for it.
  const [betPreRaw] = await db
    .select()
    .from(customBets)
    .where(eq(customBets.id, customBetId))
    .limit(1);
  if (!betPreRaw) throw new Error("Custom bet not found.");
  const betPre = await ensureFreshCustomBetOdds(db, betPreRaw);
  if (betPre.roomId !== room.id) throw new Error("Not your room.");
  if (betPre.kind !== "open_question") {
    throw new Error("Use placeCustomWager for fixed-options bets.");
  }
  if (betPre.status !== "open") throw new Error("This bet is no longer open.");
  if (betPre.locksAt && new Date(betPre.locksAt).getTime() <= Date.now()) {
    throw new Error("This bet has locked.");
  }

  const optionIdx = findOptionIdxByAnswer(betPre.options, answer);
  let newOption: CustomBetOption | null = null;
  if (optionIdx < 0) {
    const matchContext = await getCustomBetMatchContext(
      betPre.matchId ?? undefined,
      db,
      { requireMatch: Boolean(betPre.matchId) }
    );
    const ai = await generateOpenAnswerOdds({
      matchContext,
      title: betPre.title,
      description: betPre.description,
      answer,
      existingAnswers: betPre.options.map((o) => o.label),
    });
    newOption = stampCustomBetOption({
      label: answer,
      probability: ai.probability,
      odds: ai.odds,
    });
  }

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Custom bet not found.");
    if (bet.status !== "open") throw new Error("This bet is no longer open.");
    if (bet.locksAt && new Date(bet.locksAt).getTime() <= Date.now()) {
      throw new Error("This bet has locked.");
    }

    // Re-check inside the tx in case a concurrent wager added the same answer.
    let idx = findOptionIdxByAnswer(bet.options, answer);
    let optionsToWrite = bet.options;
    if (idx < 0) {
      if (!newOption) throw new Error("Odds were not computed for this answer.");
      optionsToWrite = [...bet.options, newOption];
      idx = optionsToWrite.length - 1;
      await tx
        .update(customBets)
        .set({ options: optionsToWrite })
        .where(eq(customBets.id, customBetId));
    }
    const chosen = optionsToWrite[idx];

    const [existing] = await tx
      .select({ id: customWagers.id })
      .from(customWagers)
      .where(
        and(
          eq(customWagers.customBetId, customBetId),
          eq(customWagers.userId, user.id)
        )
      )
      .limit(1);
    if (existing) throw new Error("You already wagered on this bet.");

    const updated = await tx
      .update(users)
      .set({ chips: sql`${users.chips} - ${stake}` })
      .where(and(eq(users.id, user.id), sql`${users.chips} >= ${stake}`))
      .returning({ id: users.id, chips: users.chips });
    if (updated.length === 0) throw new Error("Not enough chips.");

    await tx.insert(customWagers).values({
      customBetId,
      userId: user.id,
      optionIdx: idx,
      stake,
      oddsLocked: chosen.odds.toFixed(2),
    });

    await recordLedger(tx, {
      roomId: room.id,
      userId: user.id,
      delta: -stake,
      balanceAfter: updated[0].chips,
      reason: "custom_wager_placed",
      refCustomBetId: customBetId,
      note: `Wagered ${stake} on "${chosen.label}" — ${bet.title}`,
    });

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}

const updateOpenWagerSchema = z.object({
  customBetId: z.string().uuid(),
  answer: z.string().trim().min(1).max(80),
  stake: z.number().int().positive(),
});

export async function updateOpenWager(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const parsed = updateOpenWagerSchema.safeParse({
    customBetId: String(formData.get("customBetId") ?? ""),
    answer: String(formData.get("answer") ?? ""),
    stake: Number(formData.get("stake") ?? 0),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid wager: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const { customBetId, answer, stake } = parsed.data;

  const [betPreRaw] = await db
    .select()
    .from(customBets)
    .where(eq(customBets.id, customBetId))
    .limit(1);
  if (!betPreRaw) throw new Error("Custom bet not found.");
  const betPre = await ensureFreshCustomBetOdds(db, betPreRaw);
  if (betPre.roomId !== room.id) throw new Error("Not your room.");
  if (betPre.kind !== "open_question") {
    throw new Error("Use updateCustomWager for fixed-options bets.");
  }
  if (betPre.status !== "open") throw new Error("This bet is no longer open.");
  if (betPre.locksAt && new Date(betPre.locksAt).getTime() <= Date.now()) {
    throw new Error("This bet has locked.");
  }

  const idxPre = findOptionIdxByAnswer(betPre.options, answer);
  let newOption: CustomBetOption | null = null;
  if (idxPre < 0) {
    const matchContext = await getCustomBetMatchContext(
      betPre.matchId ?? undefined,
      db,
      { requireMatch: Boolean(betPre.matchId) }
    );
    const ai = await generateOpenAnswerOdds({
      matchContext,
      title: betPre.title,
      description: betPre.description,
      answer,
      existingAnswers: betPre.options.map((o) => o.label),
    });
    newOption = stampCustomBetOption({
      label: answer,
      probability: ai.probability,
      odds: ai.odds,
    });
  }

  await db.transaction(async (tx) => {
    const [bet] = await tx
      .select()
      .from(customBets)
      .where(eq(customBets.id, customBetId))
      .limit(1);
    if (!bet) throw new Error("Custom bet not found.");
    if (bet.status !== "open") throw new Error("This bet is no longer open.");
    if (bet.locksAt && new Date(bet.locksAt).getTime() <= Date.now()) {
      throw new Error("This bet has locked.");
    }

    let idx = findOptionIdxByAnswer(bet.options, answer);
    let optionsToWrite = bet.options;
    if (idx < 0) {
      if (!newOption) throw new Error("Odds were not computed for this answer.");
      optionsToWrite = [...bet.options, newOption];
      idx = optionsToWrite.length - 1;
      await tx
        .update(customBets)
        .set({ options: optionsToWrite })
        .where(eq(customBets.id, customBetId));
    }
    const chosen = optionsToWrite[idx];

    const [existing] = await tx
      .select()
      .from(customWagers)
      .where(
        and(
          eq(customWagers.customBetId, customBetId),
          eq(customWagers.userId, user.id)
        )
      )
      .limit(1);
    if (!existing) throw new Error("You don't have a wager on this bet.");
    if (existing.status !== "open") {
      throw new Error("This wager is no longer open.");
    }

    const delta = stake - existing.stake;
    let balanceAfter = user.chips;
    if (delta !== 0) {
      const updated = await tx
        .update(users)
        .set({ chips: sql`${users.chips} - ${delta}` })
        .where(
          and(
            eq(users.id, user.id),
            delta > 0 ? sql`${users.chips} >= ${delta}` : sql`true`
          )
        )
        .returning({ chips: users.chips });
      if (updated.length === 0) throw new Error("Not enough chips.");
      balanceAfter = updated[0].chips;
    }

    await tx
      .update(customWagers)
      .set({
        optionIdx: idx,
        stake,
        oddsLocked: chosen.odds.toFixed(2),
      })
      .where(eq(customWagers.id, existing.id));

    if (delta !== 0) {
      await recordLedger(tx, {
        roomId: room.id,
        userId: user.id,
        delta: -delta,
        balanceAfter,
        reason: "custom_wager_placed",
        refCustomBetId: customBetId,
        note: `Updated wager to ${stake} on "${chosen.label}" — ${bet.title}`,
      });
    }

    await touchRoomLiveRevision(tx, room.id);
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}
