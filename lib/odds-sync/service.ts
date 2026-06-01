import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  matchOddsSnapshots,
  matches,
  oddsSyncRuns,
  type Match,
  type ScoreOddsCache,
} from "@/lib/db/schema";
import {
  buildPolymarketTeamKey,
  normalizePolymarketProbabilities,
  priceCentsToDecimalOdds,
} from "@/lib/polymarket/world-cup";
import { fitPoissonOddsFromMarketInputs } from "@/lib/odds-sync/poisson";
import {
  fetchPolymarketWorldCupFixtureIndex,
  fetchPolymarketWorldCupMatchMarkets,
} from "@/lib/polymarket/api";

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchJson = <T>(url: string) => Promise<T>;

export type OddsSyncTrigger = "api" | "admin" | "script";

export type OddsSyncMatchResult = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  status: "success" | "error";
  message: string;
  scoreCount?: number;
};

export type OddsSyncResult = {
  runId: string;
  status: "success" | "partial_success" | "skipped" | "error";
  summary: string;
  syncedMatchIds: string[];
  matchResults: OddsSyncMatchResult[];
};

export type OddsSyncOptions = {
  matchId?: string;
  force?: boolean;
  trigger?: OddsSyncTrigger;
  fetchJson?: FetchJson;
  now?: Date;
};

type TargetMatch = Match;

function normalizeBinaryProbabilities(yesPriceCents: number, noPriceCents: number) {
  const yes = Math.max(0.001, yesPriceCents / 100);
  const no = Math.max(0.001, noPriceCents / 100);
  const total = yes + no;

  if (total <= 0) {
    throw new Error("Polymarket returned non-positive total-goals prices.");
  }

  return {
    yesProb: yes / total,
    noProb: no / total,
  };
}

async function defaultFetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Polymarket request failed (${response.status}) for ${url}.`);
  }

  return (await response.json()) as T;
}

export function getOddsSyncCooldownHours() {
  const raw = process.env.ODDS_SYNC_MIN_INTERVAL_HOURS?.trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function shouldSkipOddsSync(lastCompletedAt: Date | null, now: Date, cooldownHours: number) {
  if (!lastCompletedAt || cooldownHours <= 0) return false;
  return now.getTime() - lastCompletedAt.getTime() < cooldownHours * 60 * 60 * 1000;
}

async function loadTargets(matchId: string | undefined, now: Date): Promise<TargetMatch[]> {
  const rows = matchId
    ? await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    : await db
        .select()
        .from(matches)
        .where(and(eq(matches.status, "scheduled"), gt(matches.kickoff, now)))
        .orderBy(matches.kickoff);

  return rows;
}

function buildRunSummary(status: OddsSyncResult["status"], matchResults: OddsSyncMatchResult[]) {
  const succeeded = matchResults.filter((result) => result.status === "success").length;
  const failed = matchResults.length - succeeded;

  if (status === "skipped") return "Skipped due to sync cooldown.";
  if (matchResults.length === 0) return "No scheduled matches required syncing.";
  return `${succeeded} match${succeeded === 1 ? "" : "es"} synced, ${failed} failed.`;
}

export async function syncMatchOdds(
  options: OddsSyncOptions = {}
): Promise<OddsSyncResult> {
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const force = options.force === true;
  const trigger = options.trigger ?? "api";
  const now = options.now ?? new Date();
  const cooldownHours = getOddsSyncCooldownHours();

  const [latestCompletedRun] = await db
    .select({ completedAt: oddsSyncRuns.completedAt })
    .from(oddsSyncRuns)
    .where(and(ne(oddsSyncRuns.status, "running"), gt(oddsSyncRuns.startedAt, new Date(0))))
    .orderBy(desc(oddsSyncRuns.completedAt), desc(oddsSyncRuns.startedAt))
    .limit(1);

  if (!force && shouldSkipOddsSync(latestCompletedRun?.completedAt ?? null, now, cooldownHours)) {
    const [run] = await db
      .insert(oddsSyncRuns)
      .values({
        scope: options.matchId ? "match" : "all_future",
        targetMatchId: options.matchId ?? null,
        force,
        status: "skipped",
        summary: "Skipped due to sync cooldown.",
        details: {
          trigger,
          cooldownHours,
        },
        completedAt: now,
      })
      .returning({ id: oddsSyncRuns.id });

    return {
      runId: run.id,
      status: "skipped",
      summary: "Skipped due to sync cooldown.",
      syncedMatchIds: [],
      matchResults: [],
    };
  }

  const [run] = await db
    .insert(oddsSyncRuns)
    .values({
      scope: options.matchId ? "match" : "all_future",
      targetMatchId: options.matchId ?? null,
      force,
      status: "running",
      summary: "",
      details: {
        trigger,
        startedAt: now.toISOString(),
      },
    })
    .returning({ id: oddsSyncRuns.id });

  const matchResults: OddsSyncMatchResult[] = [];
  const syncedMatchIds: string[] = [];

  try {
    const targets = await loadTargets(options.matchId, now);
    if (targets.length === 0) {
      const summary = "No scheduled matches required syncing.";
      await db
        .update(oddsSyncRuns)
        .set({
          status: "success",
          summary,
          details: {
            trigger,
            processedMatches: 0,
          },
          completedAt: new Date(),
        })
        .where(eq(oddsSyncRuns.id, run.id));

      return {
        runId: run.id,
        status: "success",
        summary,
        syncedMatchIds,
        matchResults,
      };
    }

    const fixtureIndex = await fetchPolymarketWorldCupFixtureIndex(fetchJson);

    for (const match of targets) {
      const expectedTeamKey = buildPolymarketTeamKey(match.homeTeam, match.awayTeam);
      const indexedFixture = fixtureIndex.find((fixture) => fixture.teamKey === expectedTeamKey);

      if (!indexedFixture) {
        const message = `Polymarket has not listed ${match.homeTeam} vs ${match.awayTeam} in its World Cup API feed yet.`;
        matchResults.push({
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

      const market = await fetchPolymarketWorldCupMatchMarkets(
        fetchJson,
        match.homeTeam,
        match.awayTeam,
        {
          fixtures: fixtureIndex,
        }
      );
      if (!market) {
        const message = `Polymarket lists ${match.homeTeam} vs ${match.awayTeam}, but the match page does not currently expose a usable winner/total-goals market set.`;
        matchResults.push({
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

      try {
        const winnerPrices: [number, number, number] = [
          market.homePriceCents,
          market.drawPriceCents,
          market.awayPriceCents,
        ];

        const direction = normalizePolymarketProbabilities(winnerPrices);
        const totals = normalizeBinaryProbabilities(
          market.overPriceCents,
          market.underPriceCents
        );
        const poisson = fitPoissonOddsFromMarketInputs({
          homeProb: direction.homeProb,
          drawProb: direction.drawProb,
          awayProb: direction.awayProb,
          totalGoalsLine: market.totalGoalsLine,
          overProb: totals.yesProb,
        });
        const oddsHome = priceCentsToDecimalOdds(winnerPrices[0]);
        const oddsDraw = priceCentsToDecimalOdds(winnerPrices[1]);
        const oddsAway = priceCentsToDecimalOdds(winnerPrices[2]);

        await db.transaction(async (tx) => {
          await tx
            .update(matches)
            .set({
              oddsHome: oddsHome.toFixed(2),
              oddsDraw: oddsDraw.toFixed(2),
              oddsAway: oddsAway.toFixed(2),
              scoreOdds: poisson.scoreOdds as ScoreOddsCache,
              oddsSourceWinnerUrl: market.winnerSourceUrl,
              oddsSourceCorrectScoreUrl: market.totalsSourceUrl,
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
              sourceUrl: market.winnerSourceUrl,
              rawPayload: {
                source: "polymarket_gamma_api",
                homeTeam: market.homeTeam,
                awayTeam: market.awayTeam,
                homePriceCents: market.homePriceCents,
                drawPriceCents: market.drawPriceCents,
                awayPriceCents: market.awayPriceCents,
              },
              normalizedPayload: {
                strategy: "polymarket_match_winner",
                oddsHome,
                oddsDraw,
                oddsAway,
                homeProb: direction.homeProb,
                drawProb: direction.drawProb,
                awayProb: direction.awayProb,
              },
            },
            {
              matchId: match.id,
              runId: run.id,
              market: "correct_score",
              sourceUrl: market.totalsSourceUrl,
              rawPayload: {
                source: "polymarket_gamma_api_total_goals_plus_poisson",
                totalGoalsLine: market.totalGoalsLine,
                overPriceCents: market.overPriceCents,
                underPriceCents: market.underPriceCents,
                overProb: totals.yesProb,
                underProb: totals.noProb,
                lambdaHome: poisson.lambdaHome,
                lambdaAway: poisson.lambdaAway,
                fittedModel: poisson.model,
              },
              normalizedPayload: {
                strategy: "poisson_from_polymarket_h2h_and_total_goals",
                scoreCount: Object.keys(poisson.scoreOdds).length,
                scoreOdds: poisson.scoreOdds,
              },
            },
          ]);
        });

        syncedMatchIds.push(match.id);
        matchResults.push({
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          status: "success",
          message: `Synced Polymarket winner odds and ${Object.keys(poisson.scoreOdds).length} Poisson score lines.`,
          scoreCount: Object.keys(poisson.scoreOdds).length,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown odds sync failure.";
        matchResults.push({
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          status: "error",
          message,
        });
        await db
          .update(matches)
          .set({
            oddsSourceWinnerUrl: market.winnerSourceUrl,
            oddsSourceCorrectScoreUrl: market.totalsSourceUrl,
            oddsLastSyncStatus: "error",
            oddsLastSyncError: message,
          })
          .where(eq(matches.id, match.id));
      }
    }

    const succeeded = matchResults.filter((result) => result.status === "success").length;
    const status: OddsSyncResult["status"] =
      succeeded === 0
        ? "error"
        : succeeded === matchResults.length
          ? "success"
          : "partial_success";
    const summary = buildRunSummary(status, matchResults);

    await db
      .update(oddsSyncRuns)
      .set({
        status,
        summary,
        details: {
          trigger,
          processedMatches: matchResults.length,
          syncedMatches: syncedMatchIds.length,
          matchResults,
        },
        completedAt: new Date(),
      })
      .where(eq(oddsSyncRuns.id, run.id));

    return {
      runId: run.id,
      status,
      summary,
      syncedMatchIds,
      matchResults,
    };
  } catch (error) {
    const summary =
      error instanceof Error ? error.message : "Odds sync failed unexpectedly.";
    await db
      .update(oddsSyncRuns)
      .set({
        status: "error",
        summary,
        details: {
          trigger,
          matchResults,
        },
        completedAt: new Date(),
      })
      .where(eq(oddsSyncRuns.id, run.id));

    return {
      runId: run.id,
      status: "error",
      summary,
      syncedMatchIds,
      matchResults,
    };
  }
}
