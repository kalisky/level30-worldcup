import { readFileSync } from "node:fs";
import path from "node:path";
import { canonicalizePolymarketTeamName } from "@/lib/polymarket/world-cup";

export const ODDSCHECKER_LOCAL_FILE = path.resolve(
  process.cwd(),
  "data/oddschecker-world-cup-2026.json"
);

export type OddsCheckerImportRow = {
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  oddsHomeDecimal: number;
  oddsDrawDecimal: number;
  oddsAwayDecimal: number;
  oddsHomeFractional: string;
  oddsDrawFractional: string;
  oddsAwayFractional: string;
};

type LegacyFeedOutcome = {
  name: string;
  price: number;
};

type LegacyFeedMarket = {
  key: string;
  outcomes: LegacyFeedOutcome[];
};

type LegacyFeedBookmaker = {
  markets: LegacyFeedMarket[];
};

type LegacyFeedEvent = {
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: LegacyFeedBookmaker[];
};

const DISPLAY_TEAM_NAMES: Record<string, string> = {
  "bosnia and herzegovina": "Bosnia and Herzegovina",
  "cape verde": "Cabo Verde",
  czechia: "Czechia",
  "ivory coast": "Ivory Coast",
  iran: "IR Iran",
  "south korea": "South Korea",
  turkey: "Turkiye",
  usa: "USA",
};

export function canonicalizeImportedTeamName(value: string) {
  return canonicalizePolymarketTeamName(value);
}

export function normalizeImportedTeamName(value: string) {
  const canonical = canonicalizeImportedTeamName(value);
  return DISPLAY_TEAM_NAMES[canonical] ?? value.replace(/\s+/g, " ").trim();
}

export function buildOrderedMatchKey(homeTeam: string, awayTeam: string) {
  return `${canonicalizeImportedTeamName(homeTeam)}::${canonicalizeImportedTeamName(awayTeam)}`;
}

export function buildUnorderedMatchKey(homeTeam: string, awayTeam: string) {
  return [canonicalizeImportedTeamName(homeTeam), canonicalizeImportedTeamName(awayTeam)]
    .sort()
    .join("::");
}

export function parseFractionalOdds(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "EVS" || trimmed === "EVENS") return 2;

  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported fractional odds: ${value}`);
  }

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (denominator <= 0) {
    throw new Error(`Invalid fractional odds denominator: ${value}`);
  }

  return Math.round((1 + numerator / denominator) * 100) / 100;
}

export function americanToDecimalOdds(price: number) {
  if (!Number.isFinite(price) || price === 0) {
    throw new Error(`Invalid American odds price: ${price}`);
  }

  const decimal = price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
  return Math.round(decimal * 100) / 100;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}

export function decimalToFractionalOdds(decimalOdds: number) {
  const target = decimalOdds - 1;
  if (target <= 0) return "0/1";

  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Number.POSITIVE_INFINITY;

  for (let denominator = 1; denominator <= 100; denominator++) {
    const numerator = Math.max(1, Math.round(target * denominator));
    const error = Math.abs(numerator / denominator - target);
    if (error < bestError) {
      bestNumerator = numerator;
      bestDenominator = denominator;
      bestError = error;
    }
  }

  const divisor = gcd(bestNumerator, bestDenominator);
  return `${bestNumerator / divisor}/${bestDenominator / divisor}`;
}

export function normalizeImpliedProbabilitiesFromDecimalOdds(
  oddsHomeDecimal: number,
  oddsDrawDecimal: number,
  oddsAwayDecimal: number
) {
  const raw = [
    1 / oddsHomeDecimal,
    1 / oddsDrawDecimal,
    1 / oddsAwayDecimal,
  ].map((value) => Math.max(0.001, value));
  const total = raw.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    throw new Error("Imported odds produced a non-positive implied probability total.");
  }

  return {
    homeProb: raw[0] / total,
    drawProb: raw[1] / total,
    awayProb: raw[2] / total,
  };
}

export function loadOddsCheckerImportRows(filePath = ODDSCHECKER_LOCAL_FILE) {
  return JSON.parse(readFileSync(filePath, "utf8")) as OddsCheckerImportRow[];
}

export function indexOddsCheckerImportRows(rows: OddsCheckerImportRow[]) {
  return new Map(rows.map((row) => [buildOrderedMatchKey(row.homeTeam, row.awayTeam), row]));
}

export function indexOddsCheckerImportRowsByUnorderedTeams(rows: OddsCheckerImportRow[]) {
  return new Map(rows.map((row) => [buildUnorderedMatchKey(row.homeTeam, row.awayTeam), row]));
}

function findOutcomeDecimalOdds(
  event: LegacyFeedEvent,
  targetName: string,
  markets: LegacyFeedMarket[]
) {
  const canonicalTarget = canonicalizeImportedTeamName(targetName);
  const decimals: number[] = [];

  for (const market of markets) {
    for (const outcome of market.outcomes) {
      if (canonicalizeImportedTeamName(outcome.name) !== canonicalTarget) continue;
      decimals.push(americanToDecimalOdds(outcome.price));
    }
  }

  return decimals.length > 0 ? Math.max(...decimals) : null;
}

export function convertLegacyH2hFeedToOddsCheckerRows(events: LegacyFeedEvent[]) {
  return events
    .map((event) => {
      const h2hMarkets = event.bookmakers.flatMap((bookmaker) =>
        bookmaker.markets.filter((market) => market.key === "h2h")
      );
      const oddsHomeDecimal = findOutcomeDecimalOdds(event, event.home_team, h2hMarkets);
      const oddsAwayDecimal = findOutcomeDecimalOdds(event, event.away_team, h2hMarkets);
      const oddsDrawDecimal = findOutcomeDecimalOdds(event, "Draw", h2hMarkets);

      if (!oddsHomeDecimal || !oddsDrawDecimal || !oddsAwayDecimal) {
        throw new Error(
          `Missing h2h outcomes for ${event.home_team} vs ${event.away_team}.`
        );
      }

      return {
        kickoff: event.commence_time,
        homeTeam: normalizeImportedTeamName(event.home_team),
        awayTeam: normalizeImportedTeamName(event.away_team),
        oddsHomeDecimal,
        oddsDrawDecimal,
        oddsAwayDecimal,
        oddsHomeFractional: decimalToFractionalOdds(oddsHomeDecimal),
        oddsDrawFractional: decimalToFractionalOdds(oddsDrawDecimal),
        oddsAwayFractional: decimalToFractionalOdds(oddsAwayDecimal),
      } satisfies OddsCheckerImportRow;
    })
    .sort((left, right) => left.kickoff.localeCompare(right.kickoff));
}
