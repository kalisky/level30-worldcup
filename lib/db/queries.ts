import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  rooms,
  users,
  matches,
  matchBets,
  customBets,
  customWagers,
  settlements,
} from "./schema";

export async function getRoomByCode(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
}

export async function getRoomUsers(roomId: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.roomId, roomId))
    .orderBy(desc(users.chips), users.name);
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

export async function listOpenCustomBets(roomId: string, limit = 30) {
  return db
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
}

export async function listCustomBetsForMatch(roomId: string, matchId: string) {
  return db
    .select({
      bet: customBets,
      proposerName: users.name,
    })
    .from(customBets)
    .innerJoin(users, eq(users.id, customBets.proposerId))
    .where(and(eq(customBets.roomId, roomId), eq(customBets.matchId, matchId)))
    .orderBy(desc(customBets.createdAt));
}

export async function getCustomBet(id: string) {
  const [cb] = await db.select().from(customBets).where(eq(customBets.id, id)).limit(1);
  return cb ?? null;
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

export async function listRecentSettlements(roomId: string, limit = 20) {
  return db
    .select({
      settlement: settlements,
      actorName: users.name,
    })
    .from(settlements)
    .innerJoin(users, eq(users.id, settlements.actorId))
    .where(eq(settlements.roomId, roomId))
    .orderBy(desc(settlements.createdAt))
    .limit(limit);
}
