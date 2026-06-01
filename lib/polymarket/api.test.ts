import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPolymarketWorldCupFixtureIndex,
  fetchPolymarketWorldCupFixtureIndex,
  fetchPolymarketWorldCupMatchMarkets,
  parsePolymarketWorldCupFixture,
} from "@/lib/polymarket/api";

const taggedEvents = [
  {
    slug: "world-cup-winner",
    title: "World Cup Winner",
    sport: { sport: "fifwc" },
    markets: [],
  },
  {
    slug: "fifwc-mex-rsa-2026-06-11",
    title: "Mexico vs. South Africa",
    sport: { sport: "fifwc" },
    teams: [{ name: "Mexico" }, { name: "South Africa" }],
    markets: [
      {
        sportsMarketType: "moneyline",
        negRiskSportsMarketType: "home",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.675", "0.325"],
      },
      {
        sportsMarketType: "moneyline",
        negRiskSportsMarketType: "draw",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.215", "0.785"],
      },
      {
        sportsMarketType: "moneyline",
        negRiskSportsMarketType: "away",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.115", "0.885"],
      },
    ],
  },
  {
    slug: "fifwc-mex-rsa-2026-06-11-more-markets",
    title: "Mexico vs. South Africa - More Markets",
    sport: { sport: "fifwc" },
    markets: [
      {
        sportsMarketType: "totals",
        line: 1.5,
        liquidityNum: 10,
        volumeNum: 10,
        outcomes: ["Over", "Under"],
        outcomePrices: ["0.71", "0.29"],
      },
      {
        sportsMarketType: "totals",
        line: 2.5,
        liquidityNum: 25,
        volumeNum: 25,
        outcomes: ["Over", "Under"],
        outcomePrices: ["0.45", "0.55"],
      },
    ],
  },
  {
    slug: "fifwc-kr-cze-2026-06-11",
    title: "Korea Republic vs. Czechia",
    sport: { sport: "fifwc" },
    teams: [{ name: "Korea Republic" }, { name: "Czechia" }],
    markets: [
      {
        sportsMarketType: "moneyline",
        groupItemTitle: "Korea Republic",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.35", "0.65"],
      },
      {
        sportsMarketType: "moneyline",
        groupItemTitle: "Draw (Korea Republic vs. Czechia)",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.30", "0.70"],
      },
      {
        sportsMarketType: "moneyline",
        groupItemTitle: "Czechia",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.38", "0.62"],
      },
    ],
  },
  {
    slug: "fifwc-kr-cze-2026-06-11-more-markets",
    title: "Korea Republic vs. Czechia - More Markets",
    sport: { sport: "fifwc" },
    markets: [
      {
        sportsMarketType: "totals",
        line: 2.5,
        liquidityNum: 50,
        volumeNum: 50,
        outcomes: ["Over", "Under"],
        outcomePrices: ["0.48", "0.52"],
      },
    ],
  },
];

test("builds a World Cup fixture index from tagged Polymarket events", () => {
  const fixtures = buildPolymarketWorldCupFixtureIndex(taggedEvents);

  assert.deepEqual(
    fixtures.map((fixture) => ({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      teamKey: fixture.teamKey,
      eventSlug: fixture.eventSlug,
      moreMarketsSlug: fixture.moreMarketsSlug,
    })),
    [
      {
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        teamKey: "mexico|south-africa",
        eventSlug: "fifwc-mex-rsa-2026-06-11",
        moreMarketsSlug: "fifwc-mex-rsa-2026-06-11-more-markets",
      },
      {
        homeTeam: "Korea Republic",
        awayTeam: "Czechia",
        teamKey: "czechia|south-korea",
        eventSlug: "fifwc-kr-cze-2026-06-11",
        moreMarketsSlug: "fifwc-kr-cze-2026-06-11-more-markets",
      },
    ]
  );
});

test("combines main-event moneyline and more-markets totals from the Polymarket API payload", () => {
  const [fixture] = buildPolymarketWorldCupFixtureIndex(taggedEvents);
  const resolved = parsePolymarketWorldCupFixture(fixture);

  assert.deepEqual(resolved, {
    dateLabel: "",
    kickoffLabel: "",
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    homeTeamSlug: "mexico",
    awayTeamSlug: "south-africa",
    teamKey: "mexico|south-africa",
    homePriceCents: 67.5,
    drawPriceCents: 21.5,
    awayPriceCents: 11.5,
    totalGoalsLine: 2.5,
    overPriceCents: 45,
    underPriceCents: 55,
    winnerSourceUrl:
      "https://gamma-api.polymarket.com/events?slug=fifwc-mex-rsa-2026-06-11",
    totalsSourceUrl:
      "https://gamma-api.polymarket.com/events?slug=fifwc-mex-rsa-2026-06-11-more-markets",
  });
});

test("fetches paginated World Cup fixture events from Gamma", async () => {
  const pageOne = [
    ...taggedEvents.slice(0, 3),
    ...Array.from({ length: 97 }, (_, index) => ({
      slug: `noise-${index}`,
      title: "Noise",
      sport: { sport: "other" },
      markets: [],
    })),
  ];
  const pageTwo = taggedEvents.slice(3);

  const fixtures = await fetchPolymarketWorldCupFixtureIndex(async (url) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset") ?? "0");
    if (offset === 0) return pageOne as never;
    if (offset === 100) return pageTwo as never;
    return [] as never;
  });

  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0]?.eventSlug, "fifwc-mex-rsa-2026-06-11");
  assert.equal(fixtures[1]?.eventSlug, "fifwc-kr-cze-2026-06-11");
});

test("resolves aliases against the Polymarket fixture index and more-markets totals", async () => {
  const fixtures = buildPolymarketWorldCupFixtureIndex(taggedEvents);

  const resolved = await fetchPolymarketWorldCupMatchMarkets(
    async () => [] as never,
    "South Korea",
    "Czech Republic",
    { fixtures }
  );

  assert.equal(resolved?.homePriceCents, 35);
  assert.equal(resolved?.drawPriceCents, 30);
  assert.equal(resolved?.awayPriceCents, 38);
  assert.equal(resolved?.totalGoalsLine, 2.5);
  assert.equal(resolved?.winnerSourceUrl.includes("fifwc-kr-cze-2026-06-11"), true);
});
