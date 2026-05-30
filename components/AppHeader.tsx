import type { Room, User } from "@/lib/db/schema";
import { getAuthenticatedUser } from "@/lib/auth";
import { listRoomsForAuthUser } from "@/lib/db/queries";
import AppHeaderClient from "@/components/AppHeaderClient";

export default async function AppHeader({
  room,
  user,
  active,
  initialRoomModalOpen = false,
}: {
  room?: Room;
  user?: User;
  active?: "dashboard" | "admin";
  initialRoomModalOpen?: boolean;
}) {
  const authUser = await getAuthenticatedUser();
  const rooms = authUser ? await listRoomsForAuthUser(authUser.id) : [];
  const viewerName = authUser?.displayName ?? authUser?.googleName ?? null;

  return (
    <AppHeaderClient
      room={room}
      user={user}
      active={active}
      initialRoomModalOpen={initialRoomModalOpen}
      viewerName={viewerName}
      profileRooms={rooms.map(({ room, membership }) => ({
        id: room.id,
        code: room.code,
        name: room.name,
        chips: membership.chips,
        isCreator: membership.isCreator,
      }))}
    />
  );
}
