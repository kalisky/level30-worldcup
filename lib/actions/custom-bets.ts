"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { customBets, customWagers, matches, users } from "@/lib/db/schema";
import { requireRoomUser } from "@/lib/auth-context";
import { generateCustomBetOdds } from "@/lib/ai/odds";

const proposeSchema = z.object({
  matchId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).default(""),
  locksAtIso: z.string().trim().min(1),
  optionLabels: z
    .array(z.string().trim().min(1).max(50))
    .min(2)
    .max(5),
});

export async function proposeCustomBet(formData: FormData) {
  const code = String(formData.get("roomCode") ?? "");
  const { room, user } = await requireRoomUser(code);

  const matchIdRaw = String(formData.get("matchId") ?? "").trim();
  const matchId = matchIdRaw || undefined;
  const optionLabels = (formData.getAll("optionLabels") as string[])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const parsed = proposeSchema.safeParse({
    matchId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    locksAtIso: String(formData.get("locksAt") ?? ""),
    optionLabels,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid bet: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  const locksAt = new Date(parsed.data.locksAtIso);
  if (Number.isNaN(locksAt.getTime())) {
    throw new Error("Invalid lock time.");
  }
  if (locksAt.getTime() <= Date.now()) {
    throw new Error("Lock time must be in the future.");
  }

  let matchContext: Parameters<typeof generateCustomBetOdds>[0]["matchContext"];
  if (parsed.data.matchId) {
    const [m] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, parsed.data.matchId))
      .limit(1);
    if (!m) throw new Error("Match not found.");
    if (m.status === "final") {
      throw new Error("Cannot propose a custom bet on a final match.");
    }
    matchContext = {
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      groupLabel: m.groupLabel,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      kickoff: new Date(m.kickoff),
    };
  }

  const aiResult = await generateCustomBetOdds({
    matchContext,
    title: parsed.data.title,
    description: parsed.data.description,
    optionLabels: parsed.data.optionLabels,
  });

  const [created] = await db
    .insert(customBets)
    .values({
      roomId: room.id,
      matchId: parsed.data.matchId ?? null,
      proposerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      options: aiResult.options,
      aiReasoning: aiResult.reasoning,
      status: "open",
      locksAt,
    })
    .returning();

  if (parsed.data.matchId) {
    revalidatePath(`/r/${room.code}/match/${parsed.data.matchId}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
  revalidatePath(`/r/${room.code}/admin`);

  return { customBetId: created.id };
}

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
      .returning({ id: users.id });
    if (updated.length === 0) throw new Error("Not enough chips.");

    await tx.insert(customWagers).values({
      customBetId,
      userId: user.id,
      optionIdx,
      stake,
      oddsLocked: odds.toFixed(2),
    });
  });

  if (formData.get("matchId")) {
    revalidatePath(`/r/${room.code}/match/${String(formData.get("matchId"))}`);
  }
  revalidatePath(`/r/${room.code}/dashboard`);
}
