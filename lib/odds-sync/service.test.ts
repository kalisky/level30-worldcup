import assert from "node:assert/strict";
import test from "node:test";
import {
  getOddsSyncCooldownHours,
  shouldSkipOddsSync,
} from "@/lib/odds-sync/service";

test("cooldown helper skips only within the configured window", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  assert.equal(
    shouldSkipOddsSync(new Date("2026-05-31T10:30:00.000Z"), now, 2),
    true
  );
  assert.equal(
    shouldSkipOddsSync(new Date("2026-05-31T09:59:59.000Z"), now, 2),
    false
  );
  assert.equal(shouldSkipOddsSync(null, now, 2), false);
});

test("cooldown env parsing falls back safely", () => {
  const previous = process.env.ODDS_SYNC_MIN_INTERVAL_HOURS;

  process.env.ODDS_SYNC_MIN_INTERVAL_HOURS = "4";
  assert.equal(getOddsSyncCooldownHours(), 4);

  process.env.ODDS_SYNC_MIN_INTERVAL_HOURS = "bad";
  assert.equal(getOddsSyncCooldownHours(), 0);

  if (previous == null) {
    delete process.env.ODDS_SYNC_MIN_INTERVAL_HOURS;
  } else {
    process.env.ODDS_SYNC_MIN_INTERVAL_HOURS = previous;
  }
});
