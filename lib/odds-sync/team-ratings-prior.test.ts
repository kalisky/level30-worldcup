import assert from "node:assert/strict";
import test from "node:test";
import { deriveTeamRatingsTotalGoalsPrior } from "@/lib/odds-sync/team-ratings-prior";

test("team ratings prior produces a sane over probability", () => {
  const prior = deriveTeamRatingsTotalGoalsPrior("England", "Panama");
  assert.equal(prior.totalGoalsLine, 2.5);
  assert.ok(prior.lambdaHome > prior.lambdaAway);
  assert.ok(prior.overProb > 0);
  assert.ok(prior.overProb < 1);
});

test("team ratings prior falls back to an average team when missing", () => {
  const prior = deriveTeamRatingsTotalGoalsPrior("Unknown Home", "Unknown Away");
  assert.ok(Math.abs(prior.lambdaHome - 1.25) < 0.01);
  assert.ok(Math.abs(prior.lambdaAway - 1.25) < 0.01);
});
