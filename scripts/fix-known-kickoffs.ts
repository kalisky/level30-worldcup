import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";

// Known real kickoffs reported by the user (UTC).
// Source: Google search results referencing FIFA + Israel-time Google sports cards.
const FIXES: Array<{
  home: string;
  away: string;
  kickoffUtc: string;
  note: string;
}> = [
  {
    home: "Mexico",
    away: "South Africa",
    kickoffUtc: "2026-06-11T19:00:00.000Z", // 22:00 IDT
    note: "Opening match, Estadio Azteca, 13:00 CST",
  },
  {
    home: "South Korea",
    away: "Czechia",
    kickoffUtc: "2026-06-12T02:00:00.000Z", // 5:00 IDT
    note: "21:00 US Central same evening (June 11)",
  },
];

async function main() {
  for (const fix of FIXES) {
    const updated = await db
      .update(matches)
      .set({ kickoff: new Date(fix.kickoffUtc) })
      .where(and(eq(matches.homeTeam, fix.home), eq(matches.awayTeam, fix.away)))
      .returning({ id: matches.id, kickoff: matches.kickoff });
    if (updated.length === 0) {
      console.warn(`  ✗ ${fix.home} vs ${fix.away} — no match found`);
      continue;
    }
    console.log(
      `  ✓ ${fix.home} vs ${fix.away} → ${new Date(fix.kickoffUtc).toISOString()} (${fix.note})`
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
