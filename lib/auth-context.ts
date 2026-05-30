import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authUsers, users } from "@/lib/db/schema";
import { getRoomByCode } from "@/lib/db/queries";
import { requireProfiledUser } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";

export async function requireRoomUser(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const room = await getRoomByCode(code);
  if (!room) notFound();

  const authUser = await requireProfiledUser(`/r/${code}`);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
    .limit(1);

  if (!user) redirect(`/r/${code}`);

  if (authUser.defaultRoomId !== room.id) {
    await db
      .update(authUsers)
      .set({ defaultRoomId: room.id })
      .where(eq(authUsers.id, authUser.id));
  }

  return { room, user, authUser, code };
}
