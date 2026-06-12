// Repair: pays out bets that got stuck "open" on already-final matches.
// Matches are shared across rooms, but the old settleMatch threw
// "Match already settled." for every room after the first one to settle —
// leaving their bets open forever. This settles each (room, match) pair with
// open bets using the score recorded on the match, via the same logic the
// settle action uses. Safe to run multiple times — it only touches open bets.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { and, asc, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { matchBets, matches, rooms, users } from "../lib/db/schema";
import { settleMatchBetsForRoom } from "../lib/settle-match-core";

async function main() {
  const pairs = await db
    .selectDistinct({ roomId: matchBets.roomId, matchId: matchBets.matchId })
    .from(matchBets)
    .innerJoin(matches, eq(matches.id, matchBets.matchId))
    .where(and(eq(matchBets.status, "open"), eq(matches.status, "final")));

  if (pairs.length === 0) {
    console.log("No stuck bets found. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${pairs.length} (room, match) pairs with stuck open bets.`);

  for (const { roomId, matchId } of pairs) {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    if (!match || !room) continue;
    if (match.homeScore == null || match.awayScore == null) {
      console.warn(
        `SKIP ${match.homeTeam} vs ${match.awayTeam}: final but no recorded score.`
      );
      continue;
    }

    // The settlement audit row needs an actor; attribute it to the room
    // creator (fallback: oldest member).
    const members = await db
      .select()
      .from(users)
      .where(eq(users.roomId, roomId))
      .orderBy(asc(users.createdAt));
    const actor = members.find((m) => m.isCreator) ?? members[0];
    if (!actor) {
      console.warn(`SKIP room ${room.code}: no members to attribute settlement to.`);
      continue;
    }

    const result = await db.transaction((tx) =>
      settleMatchBetsForRoom(tx, {
        roomId,
        actorId: actor.id,
        match,
        homeScore: match.homeScore!,
        awayScore: match.awayScore!,
        repair: true,
      })
    );

    console.log(
      `Room ${room.code}: ${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam} → settled ${result.betsSettled} bets, paid out ${result.totalPaidOut} chips`
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
