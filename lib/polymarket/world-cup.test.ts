import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPolymarketTeamKey,
  canonicalizePolymarketTeamName,
  normalizePolymarketProbabilities,
  priceCentsToDecimalOdds,
} from "@/lib/polymarket/world-cup";

test("normalizes Polymarket team aliases and implied probabilities", () => {
  assert.equal(canonicalizePolymarketTeamName("Türkiye"), "turkey");
  assert.equal(canonicalizePolymarketTeamName("Korea Republic"), "south korea");
  assert.equal(canonicalizePolymarketTeamName("Côte d'Ivoire"), "ivory coast");
  assert.equal(
    buildPolymarketTeamKey("United States", "Paraguay"),
    buildPolymarketTeamKey("USA", "Paraguay")
  );

  const normalized = normalizePolymarketProbabilities([68, 22, 12]);
  assert.ok(Math.abs(normalized.homeProb + normalized.drawProb + normalized.awayProb - 1) < 1e-9);
  assert.equal(priceCentsToDecimalOdds(50), 2);
});
