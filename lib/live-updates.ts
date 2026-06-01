import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";
import { db } from "@/lib/db";
import { getMatch, getRoomByCode } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { liveRevisions, users } from "@/lib/db/schema";
import { isDailyGrantEligible } from "@/lib/daily-grant";

const ROOM_SCOPE_PREFIX = "room:";
const MATCH_SCOPE_PREFIX = "match:";
const DASHBOARD_MATCHES_SCOPE = "matches:dashboard";
let didWarnMissingLiveRevisionsTable = false;

function isMissingLiveRevisionsTable(error: unknown) {
  if (!(error instanceof Error)) return false;

  const maybeCode = (error as Error & { code?: string }).code;
  if (maybeCode === "42P01") return true;

  return (
    error.message.includes('relation "live_revisions" does not exist') ||
    error.message.includes('from "live_revisions"')
  );
}

function warnMissingLiveRevisionsTableOnce() {
  if (didWarnMissingLiveRevisionsTable) return;
  didWarnMissingLiveRevisionsTable = true;
  console.warn(
    '[live-updates] `live_revisions` table is missing. Live polling is running in compatibility mode until you apply the DB schema update.'
  );
}

function roomScope(roomId: string) {
  return `${ROOM_SCOPE_PREFIX}${roomId}`;
}

function matchScope(matchId: string) {
  return `${MATCH_SCOPE_PREFIX}${matchId}`;
}

function serializeRevision(updatedAt: Date | null) {
  return updatedAt ? updatedAt.toISOString() : "0";
}

async function getRevision(scope: string) {
  try {
    const [row] = await db
      .select({ updatedAt: liveRevisions.updatedAt })
      .from(liveRevisions)
      .where(eq(liveRevisions.scope, scope))
      .limit(1);

    return row?.updatedAt ?? null;
  } catch (error) {
    if (isMissingLiveRevisionsTable(error)) {
      warnMissingLiveRevisionsTableOnce();
      return null;
    }

    throw error;
  }
}

export async function touchLiveRevision(
  executor: Pick<typeof db, "insert">,
  scope: string
) {
  const updatedAt = new Date();

  try {
    await executor
      .insert(liveRevisions)
      .values({ scope, updatedAt })
      .onConflictDoUpdate({
        target: liveRevisions.scope,
        set: { updatedAt },
      });
  } catch (error) {
    if (isMissingLiveRevisionsTable(error)) {
      warnMissingLiveRevisionsTableOnce();
      return updatedAt;
    }

    throw error;
  }

  return updatedAt;
}

export function touchRoomLiveRevision(
  executor: Pick<typeof db, "insert">,
  roomId: string
) {
  return touchLiveRevision(executor, roomScope(roomId));
}

export function touchDashboardMatchesLiveRevision(
  executor: Pick<typeof db, "insert">
) {
  return touchLiveRevision(executor, DASHBOARD_MATCHES_SCOPE);
}

export async function touchMatchLiveRevisions(
  executor: Pick<typeof db, "insert">,
  matchId: string
) {
  await Promise.all([
    touchDashboardMatchesLiveRevision(executor),
    touchLiveRevision(executor, matchScope(matchId)),
  ]);
}

export function getDailyGrantLiveToken(
  startingChips: number,
  lastDailyGrantAt: Date | null
) {
  return isDailyGrantEligible(startingChips, lastDailyGrantAt)
    ? "daily-grant:eligible"
    : "daily-grant:waiting";
}

export async function getDashboardLiveToken(input: {
  roomId: string;
  startingChips: number;
  lastDailyGrantAt: Date | null;
}) {
  const [roomUpdatedAt, dashboardMatchesUpdatedAt] = await Promise.all([
    getRevision(roomScope(input.roomId)),
    getRevision(DASHBOARD_MATCHES_SCOPE),
  ]);

  return [
    `room=${serializeRevision(roomUpdatedAt)}`,
    `matches=${serializeRevision(dashboardMatchesUpdatedAt)}`,
    getDailyGrantLiveToken(input.startingChips, input.lastDailyGrantAt),
  ].join("|");
}

export async function getMatchLiveToken(input: {
  roomId: string;
  matchId: string;
  startingChips: number;
  lastDailyGrantAt: Date | null;
}) {
  const [roomUpdatedAt, matchUpdatedAt] = await Promise.all([
    getRevision(roomScope(input.roomId)),
    getRevision(matchScope(input.matchId)),
  ]);

  return [
    `room=${serializeRevision(roomUpdatedAt)}`,
    `match=${serializeRevision(matchUpdatedAt)}`,
    getDailyGrantLiveToken(input.startingChips, input.lastDailyGrantAt),
  ].join("|");
}

export type LivePollAccess =
  | {
      ok: true;
      code: string;
      room: NonNullable<Awaited<ReturnType<typeof getRoomByCode>>>;
      user: User;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404;
      error: string;
    };

export async function getLivePollAccess(rawCode: string): Promise<LivePollAccess> {
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    return { ok: false, status: 400, error: "Invalid room code." };
  }

  const room = await getRoomByCode(code);
  if (!room) {
    return { ok: false, status: 404, error: "Room not found." };
  }

  const authUser = await getAuthenticatedUser();
  if (!authUser?.displayName) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
    .limit(1);

  if (!user) {
    return { ok: false, status: 403, error: "Room membership required." };
  }

  return { ok: true, code, room, user };
}

export async function getLivePollMatchAccess(rawCode: string, matchId: string) {
  const roomAccess = await getLivePollAccess(rawCode);
  if (!roomAccess.ok) return roomAccess;

  const match = await getMatch(matchId);
  if (!match) {
    return { ok: false as const, status: 404 as const, error: "Match not found." };
  }

  return {
    ok: true as const,
    code: roomAccess.code,
    room: roomAccess.room,
    user: roomAccess.user,
    match,
  };
}
