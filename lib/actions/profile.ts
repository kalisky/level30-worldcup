"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { authUsers, users } from "@/lib/db/schema";
import {
  getDefaultRoomDashboardPath,
  requireAuthenticatedUser,
} from "@/lib/auth";
import { touchRoomLiveRevision } from "@/lib/live-updates";

const saveDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  next: z.string().trim().optional(),
});

export async function saveDisplayName(formData: FormData) {
  const nextPathRaw = String(formData.get("next") ?? "").trim();
  const authUser = await requireAuthenticatedUser(
    nextPathRaw || "/welcome"
  );

  const parsed = saveDisplayNameSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    next: nextPathRaw || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid profile: " + parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  const touchedRoomIds = await db.transaction(async (tx) => {
    await tx
      .update(authUsers)
      .set({ displayName: parsed.data.displayName })
      .where(eq(authUsers.id, authUser.id));

    const updatedUsers = await tx
      .update(users)
      .set({ name: parsed.data.displayName })
      .where(eq(users.authUserId, authUser.id))
      .returning({ roomId: users.roomId });

    return [...new Set(updatedUsers.map((row) => row.roomId))];
  });

  await Promise.all(touchedRoomIds.map((roomId) => touchRoomLiveRevision(db, roomId)));

  const defaultRoomPath =
    !parsed.data.next ? await getDefaultRoomDashboardPath(authUser) : null;
  redirect(parsed.data.next || defaultRoomPath || "/");
}
