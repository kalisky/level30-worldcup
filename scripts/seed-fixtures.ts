import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { buildGroupStageFixtures } from "../lib/fixtures";

async function main() {
  const fixtures = buildGroupStageFixtures();
  console.log(`Preparing to seed ${fixtures.length} group-stage matches…`);

  // Idempotent: only insert if matches table is empty.
  const existing = await db.select().from(matches).limit(1);
  if (existing.length > 0) {
    console.log("matches table already has rows — nothing to do. To reseed, truncate the table first.");
    process.exit(0);
  }

  const rows = fixtures.map((f) => ({
    groupLabel: f.groupLabel,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    kickoff: new Date(f.kickoff),
  }));

  await db.insert(matches).values(rows);
  console.log(`Inserted ${rows.length} matches.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
