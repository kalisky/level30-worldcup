// One-time backfill: writes an "opening_balance" row for every user who
// doesn't already have any ledger entries. Their current chip count becomes
// the opening line. Safe to run multiple times — it skips users who already
// have entries.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { eq, notExists, and } from "drizzle-orm";
import { db } from "../lib/db";
import { chipLedger, users } from "../lib/db/schema";

async function main() {
  const targets = await db
    .select()
    .from(users)
    .where(
      notExists(
        db.select().from(chipLedger).where(eq(chipLedger.userId, users.id))
      )
    );

  if (targets.length === 0) {
    console.log("All users already have ledger entries. Nothing to do.");
    process.exit(0);
  }

  console.log(`Writing opening_balance row for ${targets.length} users…`);

  await db.insert(chipLedger).values(
    targets.map((u) => ({
      roomId: u.roomId,
      userId: u.id,
      delta: u.chips,
      balanceAfter: u.chips,
      reason: "opening_balance" as const,
      note: "Opening balance when the chip ledger was introduced",
    }))
  );

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
