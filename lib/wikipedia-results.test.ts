import assert from "node:assert/strict";
import test from "node:test";
import { parseGroupHtml, parseKnockoutHtml } from "@/lib/wikipedia-results";

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

// Mirrors the knockout footballbox: a draw decided on penalties (the shootout
// score is a <th>H–A</th> inside the "Penalties" row) and a decisive game.
const KO_HTML = `
<table class="footballbox">
  <tr>
    <th class="fhome"><a>Japan</a></th>
    <th class="fscore">1&#8211;1 (a.e.t.)</th>
    <th class="faway"><a>Croatia</a></th>
  </tr>
  <tr class="fgoals"><td class="fhgoal">Maeda 43'</td><td class="fagoal">Perišić 55'</td></tr>
  <tr><th colspan="3">Penalties</th></tr>
  <tr class="fgoals">
    <td class="fhgoal"><span title="Penalty scored"></span></td>
    <th>1&#8211;3</th>
    <td class="fagoal"><span title="Penalty scored"></span></td>
  </tr>
</table>
<table class="footballbox">
  <tr>
    <th class="fhome"><a>Brazil</a></th>
    <th class="fscore">4&#8211;1</th>
    <th class="faway"><a>South Korea</a></th>
  </tr>
</table>
`;

test("knockout: penalty shootout sets the advancer from the shootout score", () => {
  const r = parseKnockoutHtml(KO_HTML);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {
    homeTeam: "Japan",
    awayTeam: "Croatia",
    homeScore: 1,
    awayScore: 1,
    advancer: "AWAY", // Croatia won the shootout 3–1
  });
});

test("knockout: decisive legal-time score sets the advancer directly", () => {
  const r = parseKnockoutHtml(KO_HTML);
  assert.deepEqual(r[1], {
    homeTeam: "Brazil",
    awayTeam: "South Korea",
    homeScore: 4,
    awayScore: 1,
    advancer: "HOME",
  });
});
