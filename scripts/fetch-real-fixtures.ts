import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { eq, isNotNull } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { GROUPS, GROUP_LABELS, type GroupLabel } from "../lib/fixtures";

async function fetchRealGroups(): Promise<Record<GroupLabel, string[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    "Find the official group assignments for the 2026 FIFA World Cup (final draw was held December 5, 2025 in Las Vegas).",
    "Use Google Search to verify. Authoritative sources: FIFA.com, BBC, ESPN, Reuters.",
    "",
    "There are 12 groups labeled A through L, with 4 teams each (48 teams total).",
    "Within each group, list teams in their official seeding/position order (pot 1 first, then pot 2, pot 3, pot 4).",
    "Hosts Mexico, Canada, USA are pot 1 of groups A, B, D respectively.",
    "",
    "Respond with ONLY a JSON object (no commentary) with this exact shape:",
    "{",
    '  "A": ["TeamPos1", "TeamPos2", "TeamPos3", "TeamPos4"],',
    '  "B": [...],',
    "  ... through L",
    "}",
    "",
    "Use the official English team names (e.g., \"South Korea\" not \"Korea Republic\", \"USA\" not \"United States\").",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response.");

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in response.");

  const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, string[]>;

  for (const label of GROUP_LABELS) {
    const teams = parsed[label];
    if (!Array.isArray(teams) || teams.length !== 4) {
      throw new Error(`Group ${label} is missing or malformed in AI response.`);
    }
  }
  return parsed as Record<GroupLabel, string[]>;
}

async function main() {
  console.log("Asking Gemini for the official WC2026 group assignments...");
  const realGroups = await fetchRealGroups();

  console.log("\nAI returned:");
  for (const g of GROUP_LABELS) {
    console.log(`  Group ${g}: ${realGroups[g].join(", ")}`);
  }

  // Build substitution map: current placeholder/team name → real team name.
  // Current names are from lib/fixtures.ts GROUPS.
  const subs: Record<string, string> = {};
  for (const g of GROUP_LABELS) {
    const oldTeams = GROUPS[g];
    const newTeams = realGroups[g];
    for (let i = 0; i < 4; i++) {
      subs[oldTeams[i]] = newTeams[i];
    }
  }

  console.log("\nUpdating matches in DB and clearing odds for regeneration...");

  const allMatches = await db.select().from(matches);
  let renamed = 0;
  for (const m of allMatches) {
    const newHome = subs[m.homeTeam];
    const newAway = subs[m.awayTeam];
    if (!newHome || !newAway) {
      console.warn(
        `[skip] ${m.homeTeam} vs ${m.awayTeam} — no substitution found.`
      );
      continue;
    }
    if (newHome === m.homeTeam && newAway === m.awayTeam) {
      // Already real names (hosts that we'd hardcoded), nothing to do.
      continue;
    }
    await db
      .update(matches)
      .set({
        homeTeam: newHome,
        awayTeam: newAway,
        // Clear odds so they're regenerated against the real team names.
        oddsHome: null,
        oddsDraw: null,
        oddsAway: null,
        scoreOdds: null,
      })
      .where(eq(matches.id, m.id));
    renamed++;
  }

  console.log(`\nUpdated ${renamed} matches with real team names.`);
  console.log("Now run: npm run odds:generate");
  process.exit(0);
}

main().catch((err) => {
  console.error("fetch-real-fixtures failed:", err);
  process.exit(1);
});
