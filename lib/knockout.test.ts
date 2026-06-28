import assert from "node:assert/strict";
import test from "node:test";
import { isKnockout, isPlaceholderTeam } from "@/lib/knockout";

test("group F is NOT knockout (regression: Final label must not be 'F')", () => {
  // Every single-letter group A–L must read as group stage, not knockout.
  for (const g of "ABCDEFGHIJKL") {
    assert.equal(isKnockout(g), false, `group ${g} should not be knockout`);
  }
});

test("knockout rounds are recognized", () => {
  for (const r of ["R32", "R16", "QF", "SF", "3RD", "FINAL"]) {
    assert.equal(isKnockout(r), true, `${r} should be knockout`);
  }
});

test("placeholder team detection", () => {
  for (const p of [
    "3rd Group C/E",
    "Winner Group L",
    "Runner-up Group J",
    "Winner Match 89",
    "Loser Match 101",
  ]) {
    assert.equal(isPlaceholderTeam(p), true, `${p} should be a placeholder`);
  }
  for (const real of [
    "Netherlands",
    "Tunisia",
    "Bosnia and Herzegovina",
    "Cape Verde",
    "South Korea",
    "USA",
  ]) {
    assert.equal(isPlaceholderTeam(real), false, `${real} should be real`);
  }
});
