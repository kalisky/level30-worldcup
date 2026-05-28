// Compute direction + exact-score odds for all matches locally from
// hand-calibrated team ratings. Zero API calls — the math is pure Poisson.
// Runtime custom-bet odds still go through Gemini in `lib/ai/odds.ts`.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { eq, isNull, or } from "drizzle-orm";
import { db } from "../lib/db";
import { matches, scoreKey, SCORE_RANGE, type ScoreOddsCache } from "../lib/db/schema";
import { TEAM_RATINGS } from "../lib/team-ratings";

const BASELINE = 1.25; // average WC xG per side
const MIN_ODDS = 1.05;
const MAX_DIRECTION_ODDS = 20;
const MAX_SCORE_ODDS = 100;

function poisson(k: number, lambda: number): number {
  let logFactK = 0;
  for (let i = 2; i <= k; i++) logFactK += Math.log(i);
  return Math.exp(-lambda + k * Math.log(lambda) - logFactK);
}

function probToOdds(p: number, cap: number): number {
  const minP = 1 / cap;
  const maxP = 1 / MIN_ODDS;
  return Math.round((1 / Math.min(Math.max(p, minP), maxP)) * 100) / 100;
}

function computeForMatch(home: string, away: string) {
  const hr = TEAM_RATINGS[home];
  const ar = TEAM_RATINGS[away];
  if (!hr) throw new Error(`No rating for "${home}"`);
  if (!ar) throw new Error(`No rating for "${away}"`);

  const xH = hr.atk * (ar.def / BASELINE);
  const xA = ar.atk * (hr.def / BASELINE);

  // Integrate Poisson over a wide enough grid that probability loss is tiny.
  const MAX = 15;
  const pH = Array.from({ length: MAX }, (_, k) => poisson(k, xH));
  const pA = Array.from({ length: MAX }, (_, k) => poisson(k, xA));

  let pHomeWin = 0, pDraw = 0, pAwayWin = 0;
  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      const p = pH[h] * pA[a];
      if (h > a) pHomeWin += p;
      else if (h === a) pDraw += p;
      else pAwayWin += p;
    }
  }
  const total = pHomeWin + pDraw + pAwayWin;
  pHomeWin /= total;
  pDraw /= total;
  pAwayWin /= total;

  // Exact-score odds for 0..9 grid (100 cells).
  const scoreOdds: ScoreOddsCache = {};
  for (let h = 0; h < SCORE_RANGE; h++) {
    for (let a = 0; a < SCORE_RANGE; a++) {
      const p = pH[h] * pA[a];
      scoreOdds[scoreKey(h, a)] = probToOdds(p, MAX_SCORE_ODDS);
    }
  }

  return {
    pHomeWin, pDraw, pAwayWin,
    xH, xA,
    oddsHome: probToOdds(pHomeWin, MAX_DIRECTION_ODDS),
    oddsDraw: probToOdds(pDraw, MAX_DIRECTION_ODDS),
    oddsAway: probToOdds(pAwayWin, MAX_DIRECTION_ODDS),
    scoreOdds,
  };
}

async function main() {
  const targets = await db
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

  if (targets.length === 0) {
    console.log("All matches already have odds. Nothing to do.");
    process.exit(0);
  }

  console.log(`Computing odds locally for ${targets.length} matches…\n`);

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i];
    try {
      const result = computeForMatch(m.homeTeam, m.awayTeam);
      await db
        .update(matches)
        .set({
          oddsHome: result.oddsHome.toFixed(2),
          oddsDraw: result.oddsDraw.toFixed(2),
          oddsAway: result.oddsAway.toFixed(2),
          scoreOdds: result.scoreOdds as ScoreOddsCache,
        })
        .where(eq(matches.id, m.id));

      console.log(
        `[${String(i + 1).padStart(2)}/${targets.length}] ${m.homeTeam.padEnd(22)} ${result.oddsHome.toFixed(2).padStart(5)} / ${result.oddsDraw.toFixed(2)} / ${result.oddsAway.toFixed(2).padStart(5)}  ${m.awayTeam.padEnd(22)}  (xG ${result.xH.toFixed(2)}/${result.xA.toFixed(2)})`
      );
    } catch (e) {
      console.error(`[${i + 1}] ${m.homeTeam} vs ${m.awayTeam} FAILED:`, e instanceof Error ? e.message : e);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("compute-odds failed:", err);
  process.exit(1);
});
