import assert from "node:assert/strict";
import test from "node:test";
import { indexResults, resolveFromWikipedia } from "@/lib/result-oracle";
import type { WikipediaMatchResult } from "@/lib/wikipedia-results";

const WP: WikipediaMatchResult[] = [
  // Wikipedia lists Switzerland as home; our DB stores Bosnia as home.
  {
    group: "B",
    homeTeam: "Switzerland",
    awayTeam: "Bosnia and Herzegovina",
    homeScore: 4,
    awayScore: 1,
  },
  // Wikipedia uses "Korea Republic"; our DB stores "South Korea".
  {
    group: "A",
    homeTeam: "Korea Republic",
    awayTeam: "Czech Republic",
    homeScore: 2,
    awayScore: 1,
  },
];

const index = indexResults(WP);

test("orients the score to the DB match's home team, not Wikipedia's", () => {
  const r = resolveFromWikipedia(
    { homeTeam: "Bosnia and Herzegovina", awayTeam: "Switzerland" },
    index
  );
  assert.equal(r.found, true);
  assert.equal(r.source, "wikipedia");
  // DB home is Bosnia, who scored 1; away Switzerland scored 4.
  assert.equal(r.homeScore, 1);
  assert.equal(r.awayScore, 4);
});

test("matches regardless of home/away order in the query", () => {
  const r = resolveFromWikipedia(
    { homeTeam: "Switzerland", awayTeam: "Bosnia and Herzegovina" },
    index
  );
  assert.equal(r.homeScore, 4);
  assert.equal(r.awayScore, 1);
});

test("resolves team-name aliases (South Korea = Korea Republic)", () => {
  const r = resolveFromWikipedia(
    { homeTeam: "South Korea", awayTeam: "Czech Republic" },
    index
  );
  assert.equal(r.found, true);
  assert.equal(r.homeScore, 2);
  assert.equal(r.awayScore, 1);
});

test("returns not-found for an unknown pairing", () => {
  const r = resolveFromWikipedia(
    { homeTeam: "Brazil", awayTeam: "Argentina" },
    index
  );
  assert.equal(r.found, false);
  assert.equal(r.source, "none");
});

// Knockout: Wikipedia lists Croatia as home and advancing on penalties; the DB
// stores the match with Japan as home. Both the score and the advancer must be
// oriented to the DB's home/away.
const koIndex = indexResults([], [], [
  {
    homeTeam: "Croatia",
    awayTeam: "Japan",
    homeScore: 1,
    awayScore: 1,
    advancer: "HOME", // Croatia advanced
  },
]);

test("knockout: orients score AND advancer to the DB home/away", () => {
  const r = resolveFromWikipedia(
    { homeTeam: "Japan", awayTeam: "Croatia" },
    koIndex,
    true
  );
  assert.equal(r.found, true);
  assert.equal(r.homeScore, 1);
  assert.equal(r.awayScore, 1);
  assert.equal(r.advancer, "AWAY"); // Croatia is the DB away team
});

test("knockout: lookup only hits the knockout index, not group", () => {
  // Same pair via the group resolver (knockout=false) shouldn't be found here.
  const r = resolveFromWikipedia(
    { homeTeam: "Japan", awayTeam: "Croatia" },
    koIndex,
    false
  );
  assert.equal(r.found, false);
});
