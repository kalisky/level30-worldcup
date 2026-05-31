import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authSessions, authUsers, rooms, type AuthUser } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "wc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function authRedirectPath(nextPath?: string) {
  return nextPath ? `/?next=${encodeURIComponent(nextPath)}` : "/";
}

export function profileRedirectPath(nextPath?: string) {
  return nextPath
    ? `/welcome?next=${encodeURIComponent(nextPath)}`
    : "/welcome";
}

export async function getSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const [sessionUser] = await db
    .select({ user: authUsers })
    .from(authSessions)
    .innerJoin(authUsers, eq(authUsers.id, authSessions.authUserId))
    .where(
      and(eq(authSessions.token, token), gt(authSessions.expiresAt, new Date()))
    )
    .limit(1);

  return sessionUser?.user ?? null;
}

export async function requireAuthenticatedUser(nextPath?: string) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) redirect(authRedirectPath(nextPath));
  return authUser;
}

export async function requireProfiledUser(nextPath?: string) {
  const authUser = await requireAuthenticatedUser(nextPath);
  if (!authUser.displayName) redirect(profileRedirectPath(nextPath));
  return authUser;
}

export async function getDefaultRoomDashboardPath(authUser: AuthUser) {
  if (!authUser.defaultRoomId) return null;

  const [room] = await db
    .select({ code: rooms.code })
    .from(rooms)
    .where(eq(rooms.id, authUser.defaultRoomId))
    .limit(1);

  return room ? `/r/${room.code}/dashboard` : null;
}

export async function createAppSession(authUserId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(authSessions).values({
    authUserId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function setAuthSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAuthSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function deleteCurrentAuthSession() {
  const token = await getSessionToken();
  if (!token) return;

  await db.delete(authSessions).where(eq(authSessions.token, token));
}
