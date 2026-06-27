// Seeds / re-syncs the Round of 32 from the 2026 World Cup knockout-stage
// Wikipedia page (the source of truth for real matchups + kickoff times).
// Inserts fixtures once both teams are real, generating odds then; prunes
// bet-free placeholder rows. Same engine the daily cron uses.
//
//   npm run seed:knockout            # sync fixtures + generate odds
//   npm run seed:knockout -- --rows  # rows only (no Gemini)

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { syncKnockoutFixtures } from "../lib/knockout-sync";

function canon(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    unitedstates: "usa",
    us: "usa",
    czechrepublic: "czechia",
    iriran: "iran",
    korearepublic: "southkorea",
  };
  return aliases[n] ?? n;
}

async function main() {
  const rowsOnly = process.argv.includes("--rows");

  // Map Wikipedia names → names already used in the DB (flags + i18n).
  const existing = await db
    .select({ home: matches.homeTeam, away: matches.awayTeam })
    .from(matches);
  const byCanon = new Map<string, string>();
  for (const r of existing) {
    byCanon.set(canon(r.home), r.home);
    byCanon.set(canon(r.away), r.away);
  }
  const normalizeTeam = (name: string) => byCanon.get(canon(name)) ?? name;

  const res = await syncKnockoutFixtures({ rowsOnly, normalizeTeam });
  console.log(
    `Fetched ${res.fetched} fixtures · ${res.resolved} resolved · inserted ${res.inserted.length} · removed ${res.removedPlaceholders} placeholders · odds ${res.oddsGenerated}`
  );
  for (const m of res.inserted) console.log(`  + ${m.home} vs ${m.away}`);
  for (const e of res.errors) console.error(`  ! ${e}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Knockout seed failed:", err);
  process.exit(1);
});
