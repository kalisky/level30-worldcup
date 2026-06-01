import assert from "node:assert/strict";
import test from "node:test";
import {
  americanToDecimalOdds,
  buildOrderedMatchKey,
  convertLegacyH2hFeedToOddsCheckerRows,
  decimalToFractionalOdds,
  normalizeImpliedProbabilitiesFromDecimalOdds,
  parseFractionalOdds,
} from "@/lib/odds-sync/oddschecker-file";

test("fractional odds helpers round-trip common values", () => {
  assert.equal(parseFractionalOdds("1/2"), 1.5);
  assert.equal(parseFractionalOdds("EVS"), 2);
  assert.equal(decimalToFractionalOdds(1.5), "1/2");
  assert.equal(decimalToFractionalOdds(4.4), "17/5");
});

test("american odds convert to decimal odds", () => {
  assert.equal(americanToDecimalOdds(-200), 1.5);
  assert.equal(americanToDecimalOdds(340), 4.4);
});

test("decimal odds normalize to implied probabilities", () => {
  const result = normalizeImpliedProbabilitiesFromDecimalOdds(2, 4, 5);
  const total = result.homeProb + result.drawProb + result.awayProb;
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(result.homeProb > result.drawProb);
  assert.ok(result.drawProb > result.awayProb);
});

test("legacy feed conversion picks best bookmaker price and normalizes aliases", () => {
  const rows = convertLegacyH2hFeedToOddsCheckerRows([
    {
      commence_time: "2026-06-12T02:00:00.000Z",
      home_team: "South Korea",
      away_team: "Czech Republic",
      bookmakers: [
        {
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "South Korea", price: 170 },
                { name: "Czech Republic", price: 150 },
                { name: "Draw", price: 210 },
              ],
            },
          ],
        },
        {
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "South Korea", price: 175 },
                { name: "Czech Republic", price: 170 },
                { name: "Draw", price: 225 },
              ],
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].homeTeam, "South Korea");
  assert.equal(rows[0].awayTeam, "Czechia");
  assert.equal(rows[0].oddsHomeDecimal, 2.75);
  assert.equal(rows[0].oddsDrawDecimal, 3.25);
  assert.equal(rows[0].oddsAwayDecimal, 2.7);
  assert.equal(buildOrderedMatchKey(rows[0].homeTeam, rows[0].awayTeam), "south korea::czechia");
});
