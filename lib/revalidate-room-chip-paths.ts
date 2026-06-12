import { revalidatePath } from "next/cache";

export function revalidateRoomChipPaths(roomCode: string) {
  revalidatePath(`/r/${roomCode}/dashboard`);
  revalidatePath(`/r/${roomCode}/history`);
  revalidatePath(`/r/${roomCode}/leaderboard`);
}
