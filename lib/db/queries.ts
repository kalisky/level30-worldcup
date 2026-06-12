import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { ensureFreshCustomBetOdds } from "@/lib/custom-bet-odds";
import { db } from "./index";
import {
  authSessions,
  authUsers,
  rooms,
  users,
  matches,
  matchBets,
  customBets,
  customWagers,
  settlements,
  type CustomWager,
} from "./schema";

type MatchBetWithUserName = Awaited<ReturnType<typeof getMatchBetsForMatch>>[number];
type CustomWagerWithUserName = Awaited<ReturnType<typeof getCustomWagersFor>>[number];

export async function getRoomByCode(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
}

export async function getRoomSessionAccessByCode(code: string, sessionToken: string) {
  try {
    const [row] = await db
      .select({
        room: rooms,
        authUser: authUsers,
        user: users,
      })
      .from(rooms)
      .leftJoin(
        authSessions,
        and(
          eq(authSessions.token, sessionToken),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .leftJoin(authUsers, eq(authUsers.id, authSessions.authUserId))
      .leftJoin(users, and(eq(users.roomId, rooms.id), eq(users.authUserId, authUsers.id)))
      .where(eq(rooms.code, code))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.warn("getRoomSessionAccessByCode fast path failed, falling back", {
      code,
      hasSessionToken: Boolean(sessionToken),
      error,
    });

    const room = await getRoomByCode(code);
    if (!room) return null;

    if (!sessionToken) {
      return { room, authUser: null, user: null };
    }

    const [sessionRow] = await db
      .select({ authUser: authUsers })
      .from(authSessions)
      .innerJoin(authUsers, eq(authUsers.id, authSessions.authUserId))
      .where(
        and(
          eq(authSessions.token, sessionToken),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    const authUser = sessionRow?.authUser ?? null;
    if (!authUser) {
      return { room, authUser: null, user: null };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
      .limit(1);

    return {
      room,
      authUser,
      user: user ?? null,
    };
  }
}

export async function getRoomAccessByCodeForAuthUser(code: string, authUserId: string) {
  const [row] = await db
    .select({
      room: rooms,
      user: users,
    })
    .from(rooms)
    .leftJoin(users, and(eq(users.roomId, rooms.id), eq(users.authUserId, authUserId)))
    .where(eq(rooms.code, code))
    .limit(1);

  return row ?? null;
}

export async function listRoomsForAuthUser(authUserId: string) {
  return db
    .select({
      room: rooms,
      membership: users,
    })
    .from(users)
    .innerJoin(rooms, eq(rooms.id, users.roomId))
    .where(eq(users.authUserId, authUserId))
    .orderBy(asc(rooms.name));
}

export async function getRoomUsers(roomId: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.roomId, roomId))
    .orderBy(desc(users.chips), users.name);
}

export type RoomLeaderboardEntry = {
  id: string;
  name: string;
  availableChips: number;
  chipsIncludingOpenBets: number;
  openBetChips: number;
};

export async function getRoomLeaderboard(
  roomId: string
): Promise<RoomLeaderboardEntry[]> {
  const [members, openMatchRows, openWagerRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        availableChips: users.chips,
      })
      .from(users)
      .where(eq(users.roomId, roomId)),
    db
      .select({
        userId: matchBets.userId,
        openBetChips: sql<number>`coalesce(sum(${matchBets.totalStake}), 0)::int`,
      })
      .from(matchBets)
      .where(and(eq(matchBets.roomId, roomId), eq(matchBets.status, "open")))
      .groupBy(matchBets.userId),
    db
      .select({
        userId: customWagers.userId,
        openBetChips: sql<number>`coalesce(sum(${customWagers.stake}), 0)::int`,
      })
      .from(customWagers)
      .innerJoin(customBets, eq(customBets.id, customWagers.customBetId))
      .where(and(eq(customBets.roomId, roomId), eq(customWagers.status, "open")))
      .groupBy(customWagers.userId),
  ]);

  const openBetChipsByUser = new Map<string, number>();

  for (const row of openMatchRows) {
    openBetChipsByUser.set(row.userId, row.openBetChips);
  }
  for (const row of openWagerRows) {
    openBetChipsByUser.set(
      row.userId,
      (openBetChipsByUser.get(row.userId) ?? 0) + row.openBetChips
    );
  }

  return members
    .map((member) => {
      const openBetChips = openBetChipsByUser.get(member.id) ?? 0;
      return {
        ...member,
        openBetChips,
        chipsIncludingOpenBets: member.availableChips + openBetChips,
      };
    })
    .sort((a, b) => {
      const totalDiff = b.chipsIncludingOpenBets - a.chipsIncludingOpenBets;
      if (totalDiff !== 0) return totalDiff;
      const availableDiff = b.availableChips - a.availableChips;
      if (availableDiff !== 0) return availableDiff;
      return a.name.localeCompare(b.name);
    });
}

export async function getUser(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}

export async function listMatches() {
  return db.select().from(matches).orderBy(matches.kickoff);
}

export async function listUpcomingMatches(limit = 12) {
  return db
    .select()
    .from(matches)
    .where(inArray(matches.status, ["scheduled", "live"]))
    .orderBy(matches.kickoff)
    .limit(limit);
}

/** Every fixture, played and upcoming, in kickoff order — the dashboard
 *  shows finished matches (with the user's result) instead of hiding them. */
export async function listAllMatches() {
  return db.select().from(matches).orderBy(matches.kickoff);
}

export async function getMatch(matchId: string) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return m ?? null;
}

export async function getMyMatchBets(roomId: string, userId: string) {
  return db
    .select()
    .from(matchBets)
    .where(and(eq(matchBets.roomId, roomId), eq(matchBets.userId, userId)))
    .orderBy(desc(matchBets.createdAt));
}

export async function getMatchBetForUser(
  roomId: string,
  userId: string,
  matchId: string
) {
  const [b] = await db
    .select()
    .from(matchBets)
    .where(
      and(
        eq(matchBets.roomId, roomId),
        eq(matchBets.userId, userId),
        eq(matchBets.matchId, matchId)
      )
    )
    .limit(1);
  return b ?? null;
}

export async function getMatchBetsForMatch(roomId: string, matchId: string) {
  return db
    .select({
      bet: matchBets,
      userName: users.name,
    })
    .from(matchBets)
    .innerJoin(users, eq(users.id, matchBets.userId))
    .where(and(eq(matchBets.roomId, roomId), eq(matchBets.matchId, matchId)))
    .orderBy(desc(matchBets.createdAt));
}

export async function getMatchBetBundleForMatch(
  roomId: string,
  userId: string,
  matchId: string
): Promise<{
  myBet: MatchBetWithUserName["bet"] | null;
  allBets: MatchBetWithUserName[];
}> {
  const allBets = await getMatchBetsForMatch(roomId, matchId);
  const myBet = allBets.find((row) => row.bet.userId === userId)?.bet ?? null;

  return { myBet, allBets };
}

export async function countOpenCustomBetsByMatch(
  roomId: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      matchId: customBets.matchId,
      count: sql<number>`count(*)::int`,
    })
    .from(customBets)
    .where(
      and(
        eq(customBets.roomId, roomId),
        eq(customBets.status, "open"),
        isNotNull(customBets.matchId)
      )
    )
    .groupBy(customBets.matchId);

  const map: Record<string, number> = {};
  for (const row of rows) {
    if (row.matchId) map[row.matchId] = row.count;
  }
  return map;
}

export async function listOpenCustomBets(roomId: string, limit = 30) {
  const rows = await db
    .select({
      bet: customBets,
      proposerName: users.name,
      matchHomeTeam: matches.homeTeam,
      matchAwayTeam: matches.awayTeam,
    })
    .from(customBets)
    .innerJoin(users, eq(users.id, customBets.proposerId))
    .leftJoin(matches, eq(matches.id, customBets.matchId))
    .where(and(eq(customBets.roomId, roomId), eq(customBets.status, "open")))
    .orderBy(desc(customBets.createdAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      bet: await ensureFreshCustomBetOdds(db, row.bet),
    }))
  );
}

export async function listCustomBetsForMatch(roomId: string, matchId: string) {
  const rows = await db
    .select({
      bet: customBets,
      proposerName: users.name,
    })
    .from(customBets)
    .innerJoin(users, eq(users.id, customBets.proposerId))
    .where(and(eq(customBets.roomId, roomId), eq(customBets.matchId, matchId)))
    .orderBy(desc(customBets.createdAt));

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      bet: await ensureFreshCustomBetOdds(db, row.bet),
    }))
  );
}

export async function getCustomBet(id: string) {
  const [cb] = await db.select().from(customBets).where(eq(customBets.id, id)).limit(1);
  if (!cb) return null;
  return ensureFreshCustomBetOdds(db, cb);
}

export async function getCustomWagersFor(customBetId: string) {
  return db
    .select({
      wager: customWagers,
      userName: users.name,
    })
    .from(customWagers)
    .innerJoin(users, eq(users.id, customWagers.userId))
    .where(eq(customWagers.customBetId, customBetId))
    .orderBy(desc(customWagers.createdAt));
}

export async function getCustomWagersForBets(customBetIds: string[]) {
  if (customBetIds.length === 0) {
    return [] as CustomWagerWithUserName[];
  }

  return db
    .select({
      wager: customWagers,
      userName: users.name,
    })
    .from(customWagers)
    .innerJoin(users, eq(users.id, customWagers.userId))
    .where(inArray(customWagers.customBetId, customBetIds))
    .orderBy(desc(customWagers.createdAt));
}

export async function getMyWagerOnCustomBet(customBetId: string, userId: string) {
  const [w] = await db
    .select()
    .from(customWagers)
    .where(
      and(eq(customWagers.customBetId, customBetId), eq(customWagers.userId, userId))
    )
    .limit(1);
  return w ?? null;
}

export async function hydrateCustomBetRowsWithWagers<T extends { bet: { id: string } }>(
  rows: T[],
  userId: string
): Promise<
  Array<
    T & {
      myWager: CustomWager | null;
      allWagers: CustomWagerWithUserName[];
    }
  >
> {
  if (rows.length === 0) {
    return [];
  }

  const wagerRows = await getCustomWagersForBets(rows.map((row) => row.bet.id));
  const wagerMap = new Map<string, CustomWagerWithUserName[]>();

  for (const wagerRow of wagerRows) {
    const existing = wagerMap.get(wagerRow.wager.customBetId);
    if (existing) {
      existing.push(wagerRow);
    } else {
      wagerMap.set(wagerRow.wager.customBetId, [wagerRow]);
    }
  }

  return rows.map((row) => {
    const allWagers = wagerMap.get(row.bet.id) ?? [];
    const myWager =
      allWagers.find((entry) => entry.wager.userId === userId)?.wager ?? null;

    return {
      ...row,
      myWager,
      allWagers,
    };
  });
}

export async function listRecentSettlements(roomId: string, limit = 20) {
  return db
    .select({
      settlement: settlements,
      actorName: users.name,
    })
    .from(settlements)
    .leftJoin(users, eq(users.id, settlements.actorId))
    .where(eq(settlements.roomId, roomId))
    .orderBy(desc(settlements.createdAt))
    .limit(limit);
}
