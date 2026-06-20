import assert from "node:assert/strict";
import test from "node:test";
import { parseGroupHtml } from "@/lib/wikipedia-results";

// Mimics the rendered footballbox structure on a WC group page, including the
// &#160; (nbsp) padding Wikipedia emits and a not-yet-played fixture.
const HTML = `
<table class="footballbox">
  <tr>
    <th class="fhome">Mexico&#160;</th>
    <th class="fscore"><a href="/x">2&#8211;0</a></th>
    <th class="faway">&#160;South Africa</th>
  </tr>
  <tr><td class="fgoals">Some scorer 12'</td><td class="fgoals"></td></tr>
</table>
<table class="footballbox">
  <tr>
    <th class="fhome"><span class="flagicon"></span> Switzerland</th>
    <th class="fscore">4&#8211;1</th>
    <th class="faway"><a href="/y">Bosnia and Herzegovina</a></th>
  </tr>
</table>
<table class="footballbox">
  <tr>
    <th class="fhome">Canada</th>
    <th class="fscore">Match&#160;1</th>
    <th class="faway">Qatar</th>
  </tr>
</table>
`;

test("parses finished footballbox matches and decodes entities", () => {
  const results = parseGroupHtml("B", HTML);
  // The third box has no score -> skipped.
  assert.equal(results.length, 2);

  assert.deepEqual(results[0], {
    group: "B",
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    homeScore: 2,
    awayScore: 0,
  });

  assert.deepEqual(results[1], {
    group: "B",
    homeTeam: "Switzerland",
    awayTeam: "Bosnia and Herzegovina",
    homeScore: 4,
    awayScore: 1,
  });
});

test("ignores fixtures without a numeric score", () => {
  const results = parseGroupHtml("B", HTML);
  assert.ok(!results.some((r) => r.homeTeam === "Canada"));
});
