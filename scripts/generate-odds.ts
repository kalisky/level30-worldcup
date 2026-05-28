import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { isNull, or, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { matches, type ScoreOddsCache } from "../lib/db/schema";
import { generate1X2Odds, generateScoreOdds } from "../lib/ai/odds";

async function main() {
  const missing = await db
    .select()
    .from(matches)
    .where(
      or(
        isNull(matches.oddsHome),
        isNull(matches.oddsDraw),
        isNull(matches.oddsAway),
        isNull(matches.scoreOdds)
      )
    );

  if (missing.length === 0) {
    console.log("All matches already have odds + score cache. Nothing to do.");
    process.exit(0);
  }

  console.log(`Generating odds for ${missing.length} matches…`);

  for (let i = 0; i < missing.length; i++) {
    const m = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${m.homeTeam} vs ${m.awayTeam} … `);
    try {
      const dir = await generate1X2Odds({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        groupLabel: m.groupLabel,
        kickoff: new Date(m.kickoff),
      });
      const sc = await generateScoreOdds({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        groupLabel: m.groupLabel,
        kickoff: new Date(m.kickoff),
        direction: {
          homeProb: dir.homeProb,
          drawProb: dir.drawProb,
          awayProb: dir.awayProb,
        },
      });
      await db
        .update(matches)
        .set({
          oddsHome: dir.oddsHome.toFixed(2),
          oddsDraw: dir.oddsDraw.toFixed(2),
          oddsAway: dir.oddsAway.toFixed(2),
          scoreOdds: sc.scoreOdds as ScoreOddsCache,
        })
        .where(eq(matches.id, m.id));
      console.log(
        `H ${dir.oddsHome.toFixed(2)} / D ${dir.oddsDraw.toFixed(2)} / A ${dir.oddsAway.toFixed(2)}  | xG ${sc.expectedHomeGoals.toFixed(2)}/${sc.expectedAwayGoals.toFixed(2)}`
      );
    } catch (e) {
      console.error("failed:", e instanceof Error ? e.message : e);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("odds:generate failed:", err);
  process.exit(1);
});
