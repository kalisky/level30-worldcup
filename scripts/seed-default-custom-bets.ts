import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { rooms, users } from "../lib/db/schema";
import {
  getTournamentStart,
  seedDefaultCustomBets,
} from "../lib/default-custom-bets";

async function main() {
  const locksAt = await getTournamentStart();
  console.log(`Tournament start: ${locksAt.toISOString()}`);

  const allRooms = await db.select({ id: rooms.id, code: rooms.code, name: rooms.name }).from(rooms);
  console.log(`Backfilling defaults for ${allRooms.length} rooms…`);

  for (const room of allRooms) {
    const [creator] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.roomId, room.id), eq(users.isCreator, true)))
      .limit(1);

    const proposer = creator
      ? creator
      : (
          await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.roomId, room.id))
            .limit(1)
        )[0];

    if (!proposer) {
      console.log(`  ${room.code} (${room.name}): no users yet — skipping`);
      continue;
    }

    await seedDefaultCustomBets(db, {
      roomId: room.id,
      proposerId: proposer.id,
      locksAt,
    });
    console.log(`  ${room.code} (${room.name}): proposer ${proposer.name}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
