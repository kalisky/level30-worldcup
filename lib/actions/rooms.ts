"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { authUsers, rooms, users } from "@/lib/db/schema";
import { requireProfiledUser } from "@/lib/auth";
import { requireRoomUser } from "@/lib/auth-context";
import { generateRoomCode, normalizeRoomCode } from "@/lib/code";
import { recordLedger } from "@/lib/ledger";
import {
  getTournamentStart,
  seedDefaultCustomBets,
} from "@/lib/default-custom-bets";
import { getCustomBetTargetPath } from "@/lib/share-links";

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(60),
  maxMembers: z.number().int().min(2).max(50),
});

export async function createRoom(formData: FormData) {
  const authUser = await requireProfiledUser("/room/new");

  const parsed = createRoomSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    maxMembers: Number(formData.get("maxMembers") ?? 10),
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid input: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  let code = "";
  for (let i = 0; i < 8; i++) {
    const candidate = generateRoomCode(5);
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, candidate))
      .limit(1);
    if (existing.length === 0) {
      code = candidate;
      break;
    }
  }

  if (!code) throw new Error("Could not allocate a room code; try again.");

  const created = await db.transaction(async (tx) => {
    const [room] = await tx
      .insert(rooms)
      .values({
        code,
        name: parsed.data.name,
        creatorAuthUserId: authUser.id,
        startingChips: 1000,
        maxMembers: parsed.data.maxMembers,
      })
      .returning();

    const [createdUser] = await tx
      .insert(users)
      .values({
        roomId: room.id,
        authUserId: authUser.id,
        name: authUser.displayName!,
        chips: room.startingChips,
        isCreator: true,
      })
      .returning({ id: users.id });

    await recordLedger(tx, {
      roomId: room.id,
      userId: createdUser.id,
      delta: room.startingChips,
      balanceAfter: room.startingChips,
      reason: "initial",
      note: `Opening chips for ${room.name}`,
    });

    await tx
      .update(authUsers)
      .set({ defaultRoomId: room.id })
      .where(eq(authUsers.id, authUser.id));

    const locksAt = await getTournamentStart(tx);
    await seedDefaultCustomBets(tx, {
      roomId: room.id,
      proposerId: createdUser.id,
      locksAt,
    });

    return room;
  });

  redirect(`/r/${created.code}/dashboard?created=1`);
}

export async function joinRoom(formData: FormData) {
  const roomCode = normalizeRoomCode(String(formData.get("roomCode") ?? ""));
  const customBetId = String(formData.get("bet") ?? "").trim();
  const matchId = String(formData.get("match") ?? "").trim();
  if (!roomCode) throw new Error("Missing room code.");

  const authUser = await requireProfiledUser(`/r/${roomCode}`);

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, roomCode))
    .limit(1);
  if (!room) throw new Error("Room not found.");

  const [existingMembership] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
    .limit(1);

  if (!existingMembership) {
    const [occupancy] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.roomId, room.id));

    if ((occupancy?.count ?? 0) >= room.maxMembers) {
      throw new Error("This room is full.");
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        roomId: room.id,
        authUserId: authUser.id,
        name: authUser.displayName!,
        chips: room.startingChips,
        isCreator: false,
      })
      .returning({ id: users.id });

    await recordLedger(db, {
      roomId: room.id,
      userId: createdUser.id,
      delta: room.startingChips,
      balanceAfter: room.startingChips,
      reason: "initial",
      note: `Opening chips for ${room.name}`,
    });
  }

  await db
    .update(authUsers)
    .set({ defaultRoomId: room.id })
    .where(eq(authUsers.id, authUser.id));

  if (customBetId) {
    redirect(
      getCustomBetTargetPath({
        roomCode,
        betId: customBetId,
        matchId: matchId || null,
      })
    );
  }

  redirect(`/r/${roomCode}/dashboard`);
}

export async function joinRoomByCode(formData: FormData) {
  const code = normalizeRoomCode(String(formData.get("code") ?? ""));
  if (!code) throw new Error("Enter a room code.");
  redirect(`/r/${code}`);
}

const updateRoomSettingsSchema = z.object({
  roomCode: z.string().trim().min(1),
  name: z.string().trim().min(1).max(60),
  maxMembers: z.number().int().min(2).max(50),
});

export async function updateRoomSettings(formData: FormData) {
  const roomCode = normalizeRoomCode(String(formData.get("roomCode") ?? ""));
  if (!roomCode) throw new Error("Missing room code.");

  const { room, user } = await requireRoomUser(roomCode);
  if (!user.isCreator) {
    throw new Error("Only the room creator can update the room.");
  }

  const parsed = updateRoomSettingsSchema.safeParse({
    roomCode,
    name: String(formData.get("name") ?? ""),
    maxMembers: Number(formData.get("maxMembers") ?? room.maxMembers),
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid input: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  const [occupancy] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.roomId, room.id));

  if ((occupancy?.count ?? 0) > parsed.data.maxMembers) {
    throw new Error(
      `Max members cannot be below the current member count (${occupancy?.count ?? 0}).`
    );
  }

  await db
    .update(rooms)
    .set({
      name: parsed.data.name,
      maxMembers: parsed.data.maxMembers,
    })
    .where(eq(rooms.id, room.id));

  revalidatePath(`/r/${room.code}`);
  revalidatePath(`/r/${room.code}/dashboard`);
  revalidatePath(`/r/${room.code}/admin`);
}

export async function deleteRoom(formData: FormData) {
  const roomCode = normalizeRoomCode(String(formData.get("roomCode") ?? ""));
  const confirmationName = String(formData.get("confirmationName") ?? "").trim();

  if (!roomCode) throw new Error("Missing room code.");

  const { room, user } = await requireRoomUser(roomCode);
  if (!user.isCreator) {
    throw new Error("Only the room creator can delete the room.");
  }

  if (confirmationName !== room.name) {
    throw new Error("Type the exact room name to confirm deletion.");
  }

  await db.delete(rooms).where(eq(rooms.id, room.id));

  revalidatePath("/");
}
