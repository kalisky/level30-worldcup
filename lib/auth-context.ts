import { notFound, redirect } from "next/navigation";
import { getRoomByCode, getUser } from "@/lib/db/queries";
import { getUserIdForRoom } from "@/lib/identity";
import { normalizeRoomCode } from "@/lib/code";

export async function requireRoomUser(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const room = await getRoomByCode(code);
  if (!room) notFound();

  const userId = await getUserIdForRoom(code);
  if (!userId) redirect(`/r/${code}`);

  const user = await getUser(userId);
  if (!user || user.roomId !== room.id) redirect(`/r/${code}`);

  return { room, user, code };
}
