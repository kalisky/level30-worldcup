// Updates every group-stage match's kickoff to the real FIFA-published time.
//
// Source: Sky Sports day-by-day list of all 104 matches, June 2026. The list
// is in UK time (BST = UTC+1 in June), so we subtract one hour to store UTC.
//
// We match each source row to a DB row by team-pair (set), ignoring whether
// the home/away order matches, since "home" in the DB is the draw-position
// pairing rather than the actual stadium host.

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";

// Map Sky's team names to the canonical names stored in the DB.
const NAME_ALIAS: Record<string, string> = {
  "Czech Republic": "Czechia",
  Turkey: "Turkiye",
  "Cape Verde": "Cabo Verde",
  Iran: "IR Iran",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  Curacao: "Curaçao",
};

function canonical(name: string): string {
  return NAME_ALIAS[name] ?? name;
}

type SrcRow = {
  ukDate: string; // YYYY-MM-DD
  ukTime: string; // HH:MM
  a: string;
  b: string;
};

const RAW = `
2026-06-11 20:00 Mexico vs South Africa
2026-06-12 03:00 South Korea vs Czech Republic
2026-06-12 20:00 Canada vs Bosnia & Herzegovina
2026-06-13 02:00 USA vs Paraguay
2026-06-13 20:00 Qatar vs Switzerland
2026-06-13 23:00 Brazil vs Morocco
2026-06-14 02:00 Haiti vs Scotland
2026-06-14 05:00 Australia vs Turkey
2026-06-14 18:00 Germany vs Curacao
2026-06-14 21:00 Netherlands vs Japan
2026-06-15 00:00 Ivory Coast vs Ecuador
2026-06-15 03:00 Sweden vs Tunisia
2026-06-15 17:00 Spain vs Cape Verde
2026-06-15 20:00 Belgium vs Egypt
2026-06-15 23:00 Saudi Arabia vs Uruguay
2026-06-16 02:00 Iran vs New Zealand
2026-06-16 20:00 France vs Senegal
2026-06-16 23:00 Iraq vs Norway
2026-06-17 02:00 Argentina vs Algeria
2026-06-17 05:00 Austria vs Jordan
2026-06-17 18:00 Portugal vs DR Congo
2026-06-17 21:00 England vs Croatia
2026-06-18 00:00 Ghana vs Panama
2026-06-18 03:00 Uzbekistan vs Colombia
2026-06-18 17:00 Czech Republic vs South Africa
2026-06-18 20:00 Switzerland vs Bosnia & Herzegovina
2026-06-18 23:00 Canada vs Qatar
2026-06-19 02:00 Mexico vs South Korea
2026-06-19 20:00 USA vs Australia
2026-06-19 23:00 Scotland vs Morocco
2026-06-20 01:30 Brazil vs Haiti
2026-06-20 04:00 Turkey vs Paraguay
2026-06-20 18:00 Netherlands vs Sweden
2026-06-20 21:00 Germany vs Ivory Coast
2026-06-21 01:00 Ecuador vs Curacao
2026-06-21 05:00 Tunisia vs Japan
2026-06-21 17:00 Spain vs Saudi Arabia
2026-06-21 20:00 Belgium vs Iran
2026-06-21 23:00 Uruguay vs Cape Verde
2026-06-22 02:00 New Zealand vs Egypt
2026-06-22 18:00 Argentina vs Austria
2026-06-22 22:00 France vs Iraq
2026-06-23 01:00 Norway vs Senegal
2026-06-23 04:00 Jordan vs Algeria
2026-06-23 18:00 Portugal vs Uzbekistan
2026-06-23 21:00 England vs Ghana
2026-06-24 00:00 Panama vs Croatia
2026-06-24 03:00 Colombia vs DR Congo
2026-06-24 20:00 Switzerland vs Canada
2026-06-24 20:00 Bosnia & Herzegovina vs Qatar
2026-06-24 23:00 Morocco vs Haiti
2026-06-24 23:00 Scotland vs Brazil
2026-06-25 02:00 South Africa vs South Korea
2026-06-25 02:00 Czech Republic vs Mexico
2026-06-25 21:00 Curacao vs Ivory Coast
2026-06-25 21:00 Ecuador vs Germany
2026-06-26 00:00 Tunisia vs Netherlands
2026-06-26 00:00 Japan vs Sweden
2026-06-26 03:00 Turkey vs USA
2026-06-26 03:00 Paraguay vs Australia
2026-06-26 20:00 Norway vs France
2026-06-26 20:00 Senegal vs Iraq
2026-06-27 01:00 Cape Verde vs Saudi Arabia
2026-06-27 01:00 Uruguay vs Spain
2026-06-27 04:00 New Zealand vs Belgium
2026-06-27 04:00 Egypt vs Iran
2026-06-27 22:00 Panama vs England
2026-06-27 22:00 Croatia vs Ghana
2026-06-28 00:30 Colombia vs Portugal
2026-06-28 00:30 DR Congo vs Uzbekistan
2026-06-28 03:00 Algeria vs Austria
2026-06-28 03:00 Jordan vs Argentina
`.trim();

function parseRows(text: string): SrcRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Format: "YYYY-MM-DD HH:MM TeamA vs TeamB"
      const m = line.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (.+?) vs (.+)$/);
      if (!m) throw new Error(`Cannot parse: ${line}`);
      return {
        ukDate: m[1],
        ukTime: m[2],
        a: canonical(m[3].trim()),
        b: canonical(m[4].trim()),
      };
    });
}

/** Convert UK-time (BST during the June 11–28 window) to UTC ISO. */
function ukToUtcIso(date: string, time: string): string {
  // BST = UTC+1. Subtract one hour from the UK clock to get UTC.
  const [y, mo, d] = date.split("-").map((s) => Number(s));
  const [hh, mm] = time.split(":").map((s) => Number(s));
  // BST means UK is UTC+1; UTC = UK - 1h. Date.UTC takes the UTC components,
  // so we feed it (hh - 1) and let it carry over day/month boundaries.
  const t = Date.UTC(y, mo - 1, d, hh - 1, mm);
  return new Date(t).toISOString();
}

async function main() {
  const rows = parseRows(RAW);
  console.log(`Parsed ${rows.length} source rows.`);

  const dbMatches = await db.select().from(matches);
  console.log(`DB has ${dbMatches.length} matches.`);

  // Index DB by canonical team pair (sorted, unordered).
  const byPair = new Map<string, typeof dbMatches[number]>();
  for (const m of dbMatches) {
    const key = [m.homeTeam, m.awayTeam].sort().join("|");
    byPair.set(key, m);
  }

  let updated = 0;
  let unchanged = 0;
  const unmatched: SrcRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = [row.a, row.b].sort().join("|");
    if (seen.has(key)) {
      // duplicate (shouldn't happen, but just in case)
      continue;
    }
    seen.add(key);

    const match = byPair.get(key);
    if (!match) {
      unmatched.push(row);
      continue;
    }
    const newKickoff = ukToUtcIso(row.ukDate, row.ukTime);
    if (new Date(match.kickoff).toISOString() === newKickoff) {
      unchanged++;
      continue;
    }
    await db
      .update(matches)
      .set({ kickoff: new Date(newKickoff) })
      .where(eq(matches.id, match.id));
    console.log(
      `  ✓ ${match.homeTeam} vs ${match.awayTeam}  ${new Date(match.kickoff).toISOString()} → ${newKickoff}`
    );
    updated++;
  }

  console.log(`\nUpdated ${updated}, unchanged ${unchanged}, unmatched ${unmatched.length}.`);
  if (unmatched.length > 0) {
    console.log("Unmatched source rows (no team-pair in DB):");
    for (const r of unmatched) {
      console.log(`  • ${r.a} vs ${r.b} (${r.ukDate} ${r.ukTime})`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
