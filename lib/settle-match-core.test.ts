import assert from "node:assert/strict";
import test from "node:test";
import { computeMatchBetSettlement } from "@/lib/settle-match-core";

// Minimal bet matching the Pick<> the function needs.
function bet(overrides: Partial<Parameters<typeof computeMatchBetSettlement>[0]> = {}) {
  return {
    directionPick: "AWAY" as const,
    predictedHomeScore: 1,
    predictedAwayScore: 3,
    directionStake: 100,
    scoreStake: 100,
    directionOddsLocked: "1.60",
    scoreOddsLocked: "17.51",
    ...overrides,
  };
}

test("direction wins, exact score loses (the SUI-BIH case)", () => {
  // Ofek: picked AWAY, predicted 1-3, actual 1-4. Direction right, score wrong.
  const r = computeMatchBetSettlement(bet(), 1, 4);
  assert.equal(r.directionWon, true);
  assert.equal(r.scoreWon, false);
  assert.equal(r.directionPayout, 160); // ceil(100 * 1.60)
  assert.equal(r.scorePayout, 0);
  assert.equal(r.payout, 160);
  assert.equal(r.directionOutcome, "won");
  assert.equal(r.scoreOutcome, "lost");
});

test("both direction and exact score win", () => {
  // If the actual score had been the predicted 1-3. This reproduces Ofek's
  // real 1912-chip payout: 100 * 17.51 === 1751.0000000000002 in floating
  // point, so ceil -> 1752 (not 1751). The verifier must match the live
  // settler's exact arithmetic, FP quirk included, or it would false-flag.
  const r = computeMatchBetSettlement(bet(), 1, 3);
  assert.equal(r.directionWon, true);
  assert.equal(r.scoreWon, true);
  assert.equal(r.directionPayout, 160); // ceil(100 * 1.60)
  assert.equal(r.scorePayout, 1752); // ceil(100 * 17.51) with FP rounding
  assert.equal(r.payout, 1912);
});

test("direction loses when the actual winner differs", () => {
  // Picked AWAY but home won 2-0.
  const r = computeMatchBetSettlement(bet(), 2, 0);
  assert.equal(r.directionWon, false);
  assert.equal(r.scoreWon, false);
  assert.equal(r.payout, 0);
});

test("DRAW direction settles on equal scores", () => {
  const r = computeMatchBetSettlement(
    bet({ directionPick: "DRAW", predictedHomeScore: 1, predictedAwayScore: 1 }),
    1,
    1
  );
  assert.equal(r.directionWon, true);
  assert.equal(r.scoreWon, true);
});

test("knockout: direction settles on who advanced, not the score", () => {
  // Picked AWAY to advance; legal time 1-1, away won on penalties.
  const r = computeMatchBetSettlement(
    bet({ directionPick: "AWAY", predictedHomeScore: 1, predictedAwayScore: 1 }),
    1,
    1,
    { knockout: true, advancer: "AWAY" }
  );
  assert.equal(r.directionWon, true); // advanced on pens
  assert.equal(r.scoreWon, true); // legal-time score 1-1 predicted exactly
});

test("knockout: a draw scoreline does not make HOME/AWAY direction win by score", () => {
  // Picked HOME, but AWAY advanced after a 2-2 draw + shootout.
  const r = computeMatchBetSettlement(
    bet({ directionPick: "HOME", predictedHomeScore: 0, predictedAwayScore: 0 }),
    2,
    2,
    { knockout: true, advancer: "AWAY" }
  );
  assert.equal(r.directionWon, false); // HOME did not advance
  assert.equal(r.scoreWon, false);
});

test("knockout: direction can't win before the advancer is known", () => {
  const r = computeMatchBetSettlement(
    bet({ directionPick: "HOME" }),
    1,
    1,
    { knockout: true, advancer: null }
  );
  assert.equal(r.directionWon, false);
});

test("payouts round up (ceil), never down", () => {
  // 10 * 1.65 = 16.5 -> ceil 17
  const r = computeMatchBetSettlement(
    bet({
      directionPick: "AWAY",
      directionStake: 10,
      scoreStake: 0,
      directionOddsLocked: "1.65",
      predictedHomeScore: 9,
      predictedAwayScore: 9,
    }),
    0,
    2
  );
  assert.equal(r.directionPayout, 17);
  assert.equal(r.scorePayout, 0);
});
