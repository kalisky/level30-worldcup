import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  matchOddsSnapshots,
  matches,
  oddsSyncRuns,
  type ScoreOddsCache,
} from "../lib/db/schema";
import {
  ODDSCHECKER_LOCAL_FILE,
  buildOrderedMatchKey,
  buildUnorderedMatchKey,
  indexOddsCheckerImportRows,
  indexOddsCheckerImportRowsByUnorderedTeams,
  loadOddsCheckerImportRows,
  normalizeImpliedProbabilitiesFromDecimalOdds,
} from "../lib/odds-sync/oddschecker-file";
import { fitPoissonOddsFromMarketInputs } from "../lib/odds-sync/poisson";
import { deriveTeamRatingsTotalGoalsPrior } from "../lib/odds-sync/team-ratings-prior";

const SOURCE_URL = "local://oddschecker-world-cup-2026.json";

async function main() {
  const rows = loadOddsCheckerImportRows();
  const indexedRows = indexOddsCheckerImportRows(rows);
  const unorderedRows = indexOddsCheckerImportRowsByUnorderedTeams(rows);
  const [run] = await db
    .insert(oddsSyncRuns)
    .values({
      scope: "one_time_oddschecker_file_non_polymarket",
      force: true,
      status: "running",
      summary: "",
      details: {
        sourceFile: ODDSCHECKER_LOCAL_FILE,
        sourceUrl: SOURCE_URL,
      },
    })
    .returning({ id: oddsSyncRuns.id });

  const targets = await db.select().from(matches).orderBy(matches.kickoff);
  const results: Array<{
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    status: "success" | "skipped" | "error";
    message: string;
  }> = [];
  let updatedCount = 0;

  try {
    for (const match of targets) {
      if (match.oddsSourceWinnerUrl?.includes("polymarket.com")) {
        results.push({
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          status: "skipped",
          message: "Skipped because this match already uses Polymarket as the source of truth.",
        });
        continue;
      }

      const imported =
        indexedRows.get(buildOrderedMatchKey(match.homeTeam, match.awayTeam)) ??
        unorderedRows.get(buildUnorderedMatchKey(match.homeTeam, match.awayTeam));
      if (!imported) {
        const message = `No imported OddsChecker row matched ${match.homeTeam} vs ${match.awayTeam}.`;
        results.push({
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          status: "error",
          message,
        });
        await db
          .update(matches)
          .set({
            oddsLastSyncStatus: "error",
            oddsLastSyncError: message,
          })
          .where(eq(matches.id, match.id));
        continue;
      }

      const reversed =
        buildOrderedMatchKey(imported.homeTeam, imported.awayTeam) !==
        buildOrderedMatchKey(match.homeTeam, match.awayTeam);
      const oddsHomeDecimal = reversed
        ? imported.oddsAwayDecimal
        : imported.oddsHomeDecimal;
      const oddsAwayDecimal = reversed
        ? imported.oddsHomeDecimal
        : imported.oddsAwayDecimal;
      const oddsHomeFractional = reversed
        ? imported.oddsAwayFractional
        : imported.oddsHomeFractional;
      const oddsAwayFractional = reversed
        ? imported.oddsHomeFractional
        : imported.oddsAwayFractional;

      const direction = normalizeImpliedProbabilitiesFromDecimalOdds(
        oddsHomeDecimal,
        imported.oddsDrawDecimal,
        oddsAwayDecimal
      );
      const prior = deriveTeamRatingsTotalGoalsPrior(match.homeTeam, match.awayTeam);
      const poisson = fitPoissonOddsFromMarketInputs({
        homeProb: direction.homeProb,
        drawProb: direction.drawProb,
        awayProb: direction.awayProb,
        totalGoalsLine: prior.totalGoalsLine,
        overProb: prior.overProb,
      });

      await db.transaction(async (tx) => {
        await tx
          .update(matches)
          .set({
            oddsHome: oddsHomeDecimal.toFixed(2),
            oddsDraw: imported.oddsDrawDecimal.toFixed(2),
            oddsAway: oddsAwayDecimal.toFixed(2),
            scoreOdds: poisson.scoreOdds as ScoreOddsCache,
            oddsSourceWinnerUrl: SOURCE_URL,
            oddsSourceCorrectScoreUrl: SOURCE_URL,
            oddsLastSyncedAt: new Date(),
            oddsLastSyncStatus: "success",
            oddsLastSyncError: null,
          })
          .where(eq(matches.id, match.id));

        await tx.insert(matchOddsSnapshots).values([
          {
            matchId: match.id,
            runId: run.id,
            market: "winner",
            sourceUrl: SOURCE_URL,
            rawPayload: {
              source: "oddschecker_local_file",
              kickoff: imported.kickoff,
              homeTeam: imported.homeTeam,
              awayTeam: imported.awayTeam,
              reversedToMatchOrder: reversed,
              oddsHomeFractional,
              oddsDrawFractional: imported.oddsDrawFractional,
              oddsAwayFractional,
              oddsHomeDecimal,
              oddsDrawDecimal: imported.oddsDrawDecimal,
              oddsAwayDecimal,
            },
            normalizedPayload: {
              strategy: "best_bookmaker_h2h_collapsed_to_oddschecker_file",
              homeProb: direction.homeProb,
              drawProb: direction.drawProb,
              awayProb: direction.awayProb,
            },
          },
          {
            matchId: match.id,
            runId: run.id,
            market: "correct_score",
            sourceUrl: SOURCE_URL,
            rawPayload: {
              source: "poisson_from_oddschecker_h2h_and_team_ratings_total_goals_prior",
              totalGoalsLine: prior.totalGoalsLine,
              overProb: prior.overProb,
              lambdaHomePrior: prior.lambdaHome,
              lambdaAwayPrior: prior.lambdaAway,
            },
            normalizedPayload: {
              strategy: "poisson_from_oddschecker_h2h_and_team_ratings_total_goals_prior",
              scoreCount: Object.keys(poisson.scoreOdds).length,
              scoreOdds: poisson.scoreOdds,
            },
          },
        ]);
      });

      updatedCount += 1;
      results.push({
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        status: "success",
        message: `Updated from local OddsChecker file and generated ${Object.keys(poisson.scoreOdds).length} Poisson score lines.`,
      });
    }

    const failedCount = results.filter((result) => result.status === "error").length;
    const skippedCount = results.filter((result) => result.status === "skipped").length;
    const status =
      failedCount > 0 ? (updatedCount > 0 ? "partial_success" : "error") : "success";
    const summary = `${updatedCount} non-Polymarket match${updatedCount === 1 ? "" : "es"} updated, ${skippedCount} Polymarket match${skippedCount === 1 ? "" : "es"} skipped, ${failedCount} failed.`;

    await db
      .update(oddsSyncRuns)
      .set({
        status,
        summary,
        details: {
          sourceFile: ODDSCHECKER_LOCAL_FILE,
          sourceUrl: SOURCE_URL,
          updatedCount,
          skippedCount,
          failedCount,
          results,
        },
        completedAt: new Date(),
      })
      .where(eq(oddsSyncRuns.id, run.id));

    console.log(summary);
    for (const result of results) {
      console.log(
        `[${result.status.toUpperCase()}] ${result.homeTeam} vs ${result.awayTeam}: ${result.message}`
      );
    }

    process.exit(status === "error" ? 1 : 0);
  } catch (error) {
    const summary =
      error instanceof Error
        ? error.message
        : "OddsChecker local file backfill failed unexpectedly.";

    await db
      .update(oddsSyncRuns)
      .set({
        status: "error",
        summary,
        details: {
          sourceFile: ODDSCHECKER_LOCAL_FILE,
          sourceUrl: SOURCE_URL,
          results,
        },
        completedAt: new Date(),
      })
      .where(eq(oddsSyncRuns.id, run.id));

    console.error("odds:backfill-oddschecker failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("odds:backfill-oddschecker failed:", error);
  process.exit(1);
});
