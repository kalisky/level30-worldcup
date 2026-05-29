import type { Room, User } from "@/lib/db/schema";
import AppHeader from "@/components/AppHeader";

export default function RoomHeader({
  room,
  user,
  active = "dashboard",
}: {
  room: Room;
  user: User;
  active?: "dashboard" | "admin";
}) {
  return <AppHeader room={room} user={user} active={active} />;
}
