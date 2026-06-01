import {
  buildPolymarketTeamKey,
  canonicalizePolymarketTeamName,
  POLYMARKET_GAMMA_BASE_URL,
  POLYMARKET_WORLD_CUP_EVENT_MAX_PAGES,
  POLYMARKET_WORLD_CUP_EVENT_PAGE_SIZE,
  POLYMARKET_WORLD_CUP_SPORT_SLUG,
  POLYMARKET_WORLD_CUP_TAG_ID,
  slugifyPolymarketTeam,
  type PolymarketWorldCupMoneyline,
} from "@/lib/polymarket/world-cup";

type FetchJson = <T>(url: string) => Promise<T>;

type PolymarketApiSport = {
  sport?: string | null;
};

type PolymarketApiTeam = {
  name?: string | null;
  hostStatus?: string | null;
};

type PolymarketApiMarket = {
  slug?: string | null;
  question?: string | null;
  groupItemTitle?: string | null;
  sportsMarketType?: string | null;
  negRiskSportsMarketType?: string | null;
  outcomes?: unknown;
  outcomePrices?: unknown;
  line?: number | null;
  active?: boolean;
  closed?: boolean;
  liquidity?: string | number | null;
  liquidityNum?: number | null;
  volume?: string | number | null;
  volumeNum?: number | null;
  teams?: PolymarketApiTeam[] | null;
};

type PolymarketApiEvent = {
  slug?: string | null;
  title?: string | null;
  sport?: PolymarketApiSport | string | null;
  teams?: PolymarketApiTeam[] | null;
  markets?: PolymarketApiMarket[] | null;
};

export type PolymarketWorldCupFixtureIndexEntry = {
  homeTeam: string;
  awayTeam: string;
  teamKey: string;
  eventSlug: string;
  moreMarketsSlug: string;
  winnerSourceUrl: string;
  totalsSourceUrl: string;
  winnerEvent: PolymarketApiEvent;
  moreMarketsEvent: PolymarketApiEvent | null;
};

type MatchSelection = "home" | "draw" | "away";

const FIXTURE_EVENT_SLUG_RE = /^fifwc-[a-z0-9-]+-\d{4}-\d{2}-\d{2}$/;

function normalizeComparable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGammaEventsUrl(params: Record<string, string | number | boolean>) {
  const url = new URL("/events", POLYMARKET_GAMMA_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function getEventSportSlug(event: PolymarketApiEvent) {
  if (typeof event.sport === "string") return event.sport;
  return event.sport?.sport ?? null;
}

function parseEventName(name: string) {
  const cleaned = name
    .replace(/\s+-\s+More Markets$/i, "")
    .replace(/\s+-\s+Halftime Result$/i, "")
    .trim();
  const match = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return null;
  return {
    homeTeam: match[1].trim(),
    awayTeam: match[2].trim(),
  };
}

function parseOutcomeArray(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => String(entry));

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parsePriceArray(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => Number(entry));

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => Number(entry)) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function extractOutcomePriceCents(market: PolymarketApiMarket, label: string) {
  const outcomes = parseOutcomeArray(market.outcomes);
  const prices = parsePriceArray(market.outcomePrices);
  const target = label.toLowerCase();

  if (outcomes.length !== prices.length) return null;

  const index = outcomes.findIndex((outcome) => outcome.toLowerCase() === target);
  if (index < 0) return null;

  const price = prices[index];
  if (!Number.isFinite(price)) return null;
  return Math.round(price * 100000) / 1000;
}

function detectHomeAwayTeams(event: PolymarketApiEvent) {
  const teamNames =
    event.teams
      ?.map((team) => team.name?.trim() ?? "")
      .filter((team): team is string => team.length > 0) ?? [];

  if (teamNames.length === 2) {
    return {
      homeTeam: teamNames[0],
      awayTeam: teamNames[1],
    };
  }

  if (event.title) {
    return parseEventName(event.title);
  }

  return null;
}

function detectMoneylineSelection(
  market: PolymarketApiMarket,
  homeCanonical: string,
  awayCanonical: string
): MatchSelection | null {
  const negRiskSelection = market.negRiskSportsMarketType?.toLowerCase();
  if (negRiskSelection === "home" || negRiskSelection === "draw" || negRiskSelection === "away") {
    return negRiskSelection;
  }

  const groupItemTitle = market.groupItemTitle
    ? canonicalizePolymarketTeamName(market.groupItemTitle)
    : null;

  if (groupItemTitle === homeCanonical) return "home";
  if (groupItemTitle === awayCanonical) return "away";
  if (groupItemTitle?.includes("draw")) return "draw";

  const question = normalizeComparable(
    [market.groupItemTitle, market.question, market.slug].filter(Boolean).join(" ")
  );
  if (question.includes("draw")) return "draw";
  if (question.includes(homeCanonical)) return "home";
  if (question.includes(awayCanonical)) return "away";

  return null;
}

function numericValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseMoneylineMarkets(event: PolymarketApiEvent) {
  const teams = detectHomeAwayTeams(event);
  if (!teams) return null;

  const homeCanonical = canonicalizePolymarketTeamName(teams.homeTeam);
  const awayCanonical = canonicalizePolymarketTeamName(teams.awayTeam);
  const selections: Partial<Record<MatchSelection, number>> = {};

  for (const market of event.markets ?? []) {
    if (market.active === false || market.closed === true) continue;
    if ((market.sportsMarketType ?? "").toLowerCase() !== "moneyline") continue;

    const priceCents = extractOutcomePriceCents(market, "Yes");
    if (priceCents == null) continue;

    const selection = detectMoneylineSelection(market, homeCanonical, awayCanonical);
    if (selection) {
      selections[selection] = priceCents;
    }
  }

  if (
    selections.home == null ||
    selections.draw == null ||
    selections.away == null
  ) {
    return null;
  }

  return {
    teams,
    selections: {
      home: selections.home,
      draw: selections.draw,
      away: selections.away,
    },
  };
}

function parseTotalsMarkets(event: PolymarketApiEvent | null) {
  if (!event) return null;

  const totals: Array<{
    line: number;
    overPriceCents: number;
    underPriceCents: number;
    liquidity: number;
    volume: number;
  }> = [];

  for (const market of event.markets ?? []) {
    if (market.active === false || market.closed === true) continue;
    if ((market.sportsMarketType ?? "").toLowerCase() !== "totals") continue;
    if (!Number.isFinite(market.line)) continue;

    const overPriceCents = extractOutcomePriceCents(market, "Over");
    const underPriceCents = extractOutcomePriceCents(market, "Under");
    if (overPriceCents == null || underPriceCents == null) continue;

    totals.push({
      line: Number(market.line),
      overPriceCents,
      underPriceCents,
      liquidity: numericValue(market.liquidityNum ?? market.liquidity),
      volume: numericValue(market.volumeNum ?? market.volume),
    });
  }

  return totals.sort((left, right) => {
    const lineDelta = Math.abs(left.line - 2.5) - Math.abs(right.line - 2.5);
    if (lineDelta !== 0) return lineDelta;

    const liquidityDelta = right.liquidity - left.liquidity;
    if (liquidityDelta !== 0) return liquidityDelta;

    return right.volume - left.volume;
  })[0] ?? null;
}

function buildFixtureEventUrls(eventSlug: string) {
  return {
    winnerSourceUrl: buildGammaEventsUrl({ slug: eventSlug }),
    totalsSourceUrl: buildGammaEventsUrl({ slug: `${eventSlug}-more-markets` }),
  };
}

export function buildPolymarketWorldCupFixtureIndex(events: PolymarketApiEvent[]) {
  const eventsBySlug = new Map<string, PolymarketApiEvent>();
  for (const event of events) {
    const slug = event.slug?.trim();
    if (slug) {
      eventsBySlug.set(slug, event);
    }
  }

  const fixtures: PolymarketWorldCupFixtureIndexEntry[] = [];
  for (const event of events) {
    const eventSlug = event.slug?.trim();
    if (!eventSlug || !FIXTURE_EVENT_SLUG_RE.test(eventSlug)) continue;
    if (getEventSportSlug(event) !== POLYMARKET_WORLD_CUP_SPORT_SLUG) continue;

    const teams = detectHomeAwayTeams(event);
    if (!teams) continue;

    const urls = buildFixtureEventUrls(eventSlug);
    fixtures.push({
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      teamKey: buildPolymarketTeamKey(teams.homeTeam, teams.awayTeam),
      eventSlug,
      moreMarketsSlug: `${eventSlug}-more-markets`,
      winnerSourceUrl: urls.winnerSourceUrl,
      totalsSourceUrl: urls.totalsSourceUrl,
      winnerEvent: event,
      moreMarketsEvent: eventsBySlug.get(`${eventSlug}-more-markets`) ?? null,
    });
  }

  return fixtures;
}

async function fetchPolymarketWorldCupTaggedEvents(fetchJson: FetchJson) {
  const events: PolymarketApiEvent[] = [];

  for (let page = 0; page < POLYMARKET_WORLD_CUP_EVENT_MAX_PAGES; page += 1) {
    const offset = page * POLYMARKET_WORLD_CUP_EVENT_PAGE_SIZE;
    const url = buildGammaEventsUrl({
      tag_id: POLYMARKET_WORLD_CUP_TAG_ID,
      active: true,
      closed: false,
      limit: POLYMARKET_WORLD_CUP_EVENT_PAGE_SIZE,
      offset,
    });
    const pageEvents = await fetchJson<PolymarketApiEvent[]>(url);
    if (!Array.isArray(pageEvents) || pageEvents.length === 0) break;

    events.push(...pageEvents);
    if (pageEvents.length < POLYMARKET_WORLD_CUP_EVENT_PAGE_SIZE) break;
  }

  return events;
}

export async function fetchPolymarketWorldCupFixtureIndex(fetchJson: FetchJson) {
  return buildPolymarketWorldCupFixtureIndex(await fetchPolymarketWorldCupTaggedEvents(fetchJson));
}

export function parsePolymarketWorldCupFixture(
  fixture: PolymarketWorldCupFixtureIndexEntry
): PolymarketWorldCupMoneyline | null {
  const moneyline = parseMoneylineMarkets(fixture.winnerEvent);
  if (!moneyline) return null;

  const totals = parseTotalsMarkets(fixture.moreMarketsEvent ?? fixture.winnerEvent);
  if (!totals) return null;

  return {
    dateLabel: "",
    kickoffLabel: "",
    homeTeam: moneyline.teams.homeTeam,
    awayTeam: moneyline.teams.awayTeam,
    homeTeamSlug: slugifyPolymarketTeam(moneyline.teams.homeTeam),
    awayTeamSlug: slugifyPolymarketTeam(moneyline.teams.awayTeam),
    teamKey: buildPolymarketTeamKey(moneyline.teams.homeTeam, moneyline.teams.awayTeam),
    homePriceCents: moneyline.selections.home,
    drawPriceCents: moneyline.selections.draw,
    awayPriceCents: moneyline.selections.away,
    totalGoalsLine: totals.line,
    overPriceCents: totals.overPriceCents,
    underPriceCents: totals.underPriceCents,
    winnerSourceUrl: fixture.winnerSourceUrl,
    totalsSourceUrl:
      fixture.moreMarketsEvent?.slug != null
        ? fixture.totalsSourceUrl
        : fixture.winnerSourceUrl,
  };
}

export async function fetchPolymarketWorldCupMatchMarkets(
  fetchJson: FetchJson,
  homeTeam: string,
  awayTeam: string,
  options?: {
    fixtures?: PolymarketWorldCupFixtureIndexEntry[];
  }
) {
  const fixtures = options?.fixtures ?? (await fetchPolymarketWorldCupFixtureIndex(fetchJson));
  const expectedTeamKey = buildPolymarketTeamKey(homeTeam, awayTeam);
  const fixture = fixtures.find((entry) => entry.teamKey === expectedTeamKey);

  if (!fixture) return null;

  const market = parsePolymarketWorldCupFixture(fixture);
  if (!market) return null;

  const actualTeamKey = buildPolymarketTeamKey(market.homeTeam, market.awayTeam);
  if (actualTeamKey !== expectedTeamKey) return null;

  return market;
}
