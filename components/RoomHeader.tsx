import type { Room, User } from "@/lib/db/schema";
import AppHeader from "@/components/AppHeader";

export default function RoomHeader({
  room,
  user,
  active = "dashboard",
  initialRoomModalOpen = false,
}: {
  room: Room;
  user: User;
  active?: "dashboard" | "admin" | "stats";
  initialRoomModalOpen?: boolean;
}) {
  return (
    <AppHeader
      room={room}
      user={user}
      active={active}
      initialRoomModalOpen={initialRoomModalOpen}
    />
  );
}
