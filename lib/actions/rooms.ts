"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { rooms, users } from "@/lib/db/schema";
import { generateRoomCode, normalizeRoomCode } from "@/lib/code";
import { setUserIdForRoom } from "@/lib/identity";

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startingChips: z.number().int().positive().max(1_000_000),
  members: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
});

export async function createRoom(formData: FormData) {
  const raw = {
    name: String(formData.get("name") ?? ""),
    startingChips: Number(formData.get("startingChips") ?? 1000),
    members: (formData.getAll("members") as string[])
      .map((m) => m.trim())
      .filter((m) => m.length > 0),
  };

  const parsed = createRoomSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Invalid input: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  // Find an unused code (retry a few times).
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

  const memberNames = Array.from(new Set(parsed.data.members));
  if (memberNames.length !== parsed.data.members.length) {
    throw new Error("Friend names must be unique.");
  }

  const created = await db.transaction(async (tx) => {
    const [room] = await tx
      .insert(rooms)
      .values({
        code,
        name: parsed.data.name,
        startingChips: parsed.data.startingChips,
      })
      .returning();

    const createdUsers = await tx
      .insert(users)
      .values(
        memberNames.map((name, idx) => ({
          roomId: room.id,
          name,
          chips: parsed.data.startingChips,
          isCreator: idx === 0,
        }))
      )
      .returning();

    return { room, users: createdUsers };
  });

  // Set the cookie for the creator (first member) so they go straight to dashboard.
  await setUserIdForRoom(created.room.code, created.users[0].id);

  redirect(`/r/${created.room.code}/dashboard`);
}

export async function selectIdentity(formData: FormData) {
  const roomCode = normalizeRoomCode(String(formData.get("roomCode") ?? ""));
  const userId = String(formData.get("userId") ?? "");
  if (!roomCode || !userId) throw new Error("Missing room code or user id.");

  // Verify user is in this room.
  const found = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(rooms, eq(rooms.id, users.roomId))
    .where(eq(rooms.code, roomCode))
    .limit(50);
  if (!found.some((u) => u.id === userId)) {
    throw new Error("That user is not in this room.");
  }

  await setUserIdForRoom(roomCode, userId);
  redirect(`/r/${roomCode}/dashboard`);
}

export async function joinRoomByCode(formData: FormData) {
  const code = normalizeRoomCode(String(formData.get("code") ?? ""));
  if (!code) throw new Error("Enter a room code.");
  redirect(`/r/${code}`);
}
