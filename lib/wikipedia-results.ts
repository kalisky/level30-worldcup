// Independent score source for the morning verification cron. Ported from
// Elon's `fetch_scores_from_wiki.py`: scrapes each 2026 World Cup group page's
// `footballbox` blocks for the home team, away team, and final score. We
// deliberately use Wikipedia (not the app's own Gemini+Search settler) so the
// check has a source that can't repeat the settler's own mistakes.
//
// Only the final score is needed here, so the goal-by-goal parsing in the
// original script is dropped. Group stage only — knockout fixtures live on
// different pages and fall back to Gemini in the oracle.

const WIKI_USER_AGENT =
  "Mozilla/5.0 (compatible; WC2026BetsBot/1.0; verification cron)";

export type WikipediaMatchResult = {
  group: string; // "A".."L"
  homeTeam: string; // rendered team name, e.g. "Bosnia and Herzegovina"
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

/** Decode the HTML entities that survive tag-stripping. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // last, so decoded entities aren't re-decoded
}

/** Strip tags + bracketed footnotes, collapse whitespace. */
function cellText(html: string): string {
  const noTags = html.replace(/<[^>]*>/g, " ");
  const noRefs = noTags.replace(/\[[^\]]*\]/g, " "); // [1], [a], [Report]
  return decodeEntities(noRefs).replace(/\s+/g, " ").trim();
}

/**
 * Pulls the inner HTML of every cell carrying `class="<className>"` in document
 * order. footballbox cells are `<th>`/`<td>` and the fhome/faway/fscore cells
 * themselves contain no nested `<th>/<td>`, so a non-greedy match to the first
 * closing cell tag is safe.
 */
function extractCells(html: string, className: string): string[] {
  const re = new RegExp(
    `class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)</(?:th|td)>`,
    "g"
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** Parse one group page's HTML into finished-match results. */
export function parseGroupHtml(group: string, html: string): WikipediaMatchResult[] {
  const homes = extractCells(html, "fhome");
  const scores = extractCells(html, "fscore");
  const aways = extractCells(html, "faway");

  // Each footballbox contributes exactly one of each, in the same order.
  const n = Math.min(homes.length, scores.length, aways.length);
  const results: WikipediaMatchResult[] = [];
  for (let i = 0; i < n; i++) {
    const scoreText = cellText(scores[i]);
    const sm = /(\d+)\s*[–\-:]\s*(\d+)/.exec(scoreText);
    if (!sm) continue; // not yet played / no final score
    const homeTeam = cellText(homes[i]);
    const awayTeam = cellText(aways[i]);
    if (!homeTeam || !awayTeam) continue;
    results.push({
      group,
      homeTeam,
      awayTeam,
      homeScore: Number(sm[1]),
      awayScore: Number(sm[2]),
    });
  }
  return results;
}

async function fetchGroupHtml(letter: string): Promise<string> {
  const url = `https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_${letter}`;
  const res = await fetch(url, {
    headers: { "User-Agent": WIKI_USER_AGENT },
    // Always hit the network — we want the freshest result.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Wikipedia Group ${letter} returned HTTP ${res.status}`);
  }
  return res.text();
}

/** Fetch + parse one group's finished matches. */
export async function fetchGroupResults(
  letter: string
): Promise<WikipediaMatchResult[]> {
  const html = await fetchGroupHtml(letter);
  return parseGroupHtml(letter, html);
}

/**
 * Fetch every group page (A–L) and return all finished-match results. Pages are
 * fetched concurrently; a single failing group is skipped rather than failing
 * the whole batch.
 */
export async function fetchAllGroupResults(): Promise<{
  results: WikipediaMatchResult[];
  errors: { group: string; error: string }[];
}> {
  const settled = await Promise.allSettled(
    GROUP_LETTERS.map((l) => fetchGroupResults(l))
  );
  const results: WikipediaMatchResult[] = [];
  const errors: { group: string; error: string }[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") results.push(...s.value);
    else
      errors.push({
        group: GROUP_LETTERS[i],
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      });
  });
  return { results, errors };
}
