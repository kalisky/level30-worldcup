import { cookies } from "next/headers";

export function userCookieName(roomCode: string) {
  return `wc_user_${roomCode}`;
}

export async function getUserIdForRoom(roomCode: string): Promise<string | null> {
  const store = await cookies();
  return store.get(userCookieName(roomCode))?.value ?? null;
}

export async function setUserIdForRoom(roomCode: string, userId: string) {
  const store = await cookies();
  store.set(userCookieName(roomCode), userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function clearUserIdForRoom(roomCode: string) {
  const store = await cookies();
  store.delete(userCookieName(roomCode));
}
