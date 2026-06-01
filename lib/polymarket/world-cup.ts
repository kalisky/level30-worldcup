export const POLYMARKET_GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
export const POLYMARKET_WORLD_CUP_SPORT_SLUG = "fifwc";
export const POLYMARKET_WORLD_CUP_TAG_ID = 102232;
export const POLYMARKET_WORLD_CUP_EVENT_PAGE_SIZE = 100;
export const POLYMARKET_WORLD_CUP_EVENT_MAX_PAGES = 10;

export type PolymarketWorldCupMoneyline = {
  dateLabel: string;
  kickoffLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  teamKey: string;
  homePriceCents: number;
  drawPriceCents: number;
  awayPriceCents: number;
  totalGoalsLine: number;
  overPriceCents: number;
  underPriceCents: number;
  winnerSourceUrl: string;
  totalsSourceUrl: string;
};

const TEAM_NAME_ALIASES: Record<string, string> = {
  "bosnia and herzegovina": "bosnia and herzegovina",
  "bosnia herzegovina": "bosnia and herzegovina",
  "cabo verde": "cape verde",
  "cape verde": "cape verde",
  czechia: "czechia",
  "czech republic": "czechia",
  "cote d ivoire": "ivory coast",
  "ir iran": "iran",
  iran: "iran",
  "korea republic": "south korea",
  "south korea": "south korea",
  "ivory coast": "ivory coast",
  turkiye: "turkey",
  turkey: "turkey",
  "united states": "usa",
  usa: "usa",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string) {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizePolymarketTeamName(value: string) {
  const normalized = normalizeComparable(value);
  return TEAM_NAME_ALIASES[normalized] ?? normalized;
}

export function slugifyPolymarketTeam(value: string) {
  return canonicalizePolymarketTeamName(value)
    .replace(/\band\b/g, "and")
    .replace(/\s+/g, "-");
}

export function buildPolymarketTeamKey(homeTeam: string, awayTeam: string) {
  return [slugifyPolymarketTeam(homeTeam), slugifyPolymarketTeam(awayTeam)]
    .sort()
    .join("|");
}

export function normalizePolymarketProbabilities(pricesInCents: [number, number, number]) {
  const raw = pricesInCents.map((price) => Math.max(0.001, price / 100));
  const sum = raw.reduce((total, value) => total + value, 0);
  if (sum <= 0) {
    throw new Error("Polymarket returned non-positive winner prices.");
  }

  return {
    homeProb: raw[0] / sum,
    drawProb: raw[1] / sum,
    awayProb: raw[2] / sum,
  };
}

export function priceCentsToDecimalOdds(priceInCents: number) {
  const probability = Math.min(Math.max(priceInCents / 100, 0.01), 0.99);
  return Math.round((1 / probability) * 100) / 100;
}
