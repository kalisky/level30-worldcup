import assert from "node:assert/strict";
import test from "node:test";
import { fitPoissonOddsFromMarketInputs } from "@/lib/odds-sync/poisson";

test("fits a Poisson score grid from H2H and total-goals inputs", () => {
  const fitted = fitPoissonOddsFromMarketInputs({
    homeProb: 0.49,
    drawProb: 0.27,
    awayProb: 0.24,
    totalGoalsLine: 2.5,
    overProb: 0.46,
  });

  assert.ok(fitted.lambdaHome > 0);
  assert.ok(fitted.lambdaAway > 0);
  assert.ok(Math.abs(fitted.model.homeProb - 0.49) < 0.05);
  assert.ok(Math.abs(fitted.model.drawProb - 0.27) < 0.05);
  assert.ok(Math.abs(fitted.model.awayProb - 0.24) < 0.05);
  assert.ok(Math.abs(fitted.model.overProb - 0.46) < 0.05);
  assert.ok(Object.keys(fitted.scoreOdds).length > 0);
  assert.ok(fitted.scoreOdds["1-0"] > 0);
  assert.ok(fitted.scoreOdds["1-1"] > 0);
});
