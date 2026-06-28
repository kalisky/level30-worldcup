// Authoritative final-score lookup for settlement + the verification cron.
// Wikipedia (an independent source) is primary; the app's own Gemini+Search
// settler is the fallback only when Wikipedia hasn't published a result yet.
// Group matches come from the group pages; knockout matches from the knockout
// stage page, which also yields the advancer (incl. penalty shootouts).

import type { Match } from "@/lib/db/schema";
import { isKnockout } from "@/lib/knockout";
import {
  fetchAllGroupResults,
  fetchKnockoutResults,
  type WikipediaMatchResult,
  type WikipediaKnockoutResult,
} from "@/lib/wikipedia-results";
import { suggestMatchResult } from "@/lib/ai/suggest";

export type AuthoritativeResult = {
  found: boolean;
  /** Oriented to the DB match's HOME team, not the source's home designation. */
  homeScore?: number;
  awayScore?: number;
  /** Knockout only: which side advanced, oriented to the DB home/away. */
  advancer?: "HOME" | "AWAY" | null;
  source: "wikipedia" | "gemini" | "none";
  reasoning: string;
};

// Wikipedia occasionally renders a team under a different English name than the
// app stores. Canonicalize the known divergences so set-matching still works.
const NAME_ALIASES: Record<string, string> = {
  korearepublic: "southkorea",
  republicofkorea: "southkorea",
  koreadpr: "northkorea",
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  us: "usa",
  iriran: "iran",
  cotedivoire: "ivorycoast",
  turkiye: "turkey",
  czechia: "czechrepublic",
  bosnia: "bosniaandherzegovina",
  caboverde: "capeverde",
};

function canon(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]/g, "");
  return NAME_ALIASES[n] ?? n;
}

/** Stable key for an unordered pair of teams. */
function pairKey(a: string, b: string): string {
  return [canon(a), canon(b)].sort().join("|");
}

export type WikipediaIndex = {
  byPair: Map<string, WikipediaMatchResult>;
  knockoutByPair: Map<string, WikipediaKnockoutResult>;
  errors: { group: string; error: string }[];
};

/** Index parsed results by team pair (exported for testing). */
export function indexResults(
  results: WikipediaMatchResult[],
  errors: { group: string; error: string }[] = [],
  knockout: WikipediaKnockoutResult[] = []
): WikipediaIndex {
  const byPair = new Map<string, WikipediaMatchResult>();
  for (const r of results) byPair.set(pairKey(r.homeTeam, r.awayTeam), r);
  const knockoutByPair = new Map<string, WikipediaKnockoutResult>();
  for (const r of knockout)
    knockoutByPair.set(pairKey(r.homeTeam, r.awayTeam), r);
  return { byPair, knockoutByPair, errors };
}

/** Fetch the group pages + knockout page once and index by team pair. */
export async function buildWikipediaIndex(): Promise<WikipediaIndex> {
  const [group, knockout] = await Promise.all([
    fetchAllGroupResults(),
    fetchKnockoutResults().catch((e) => {
      // Knockout page may not exist / have results yet — don't fail the batch.
      return { error: e instanceof Error ? e.message : String(e) };
    }),
  ]);
  const knockoutResults =
    "error" in knockout ? [] : (knockout as WikipediaKnockoutResult[]);
  const errors = [...group.errors];
  if ("error" in knockout)
    errors.push({ group: "knockout", error: knockout.error });
  return indexResults(group.results, errors, knockoutResults);
}

/** Resolve one match from a prebuilt Wikipedia index, oriented to DB home/away. */
export function resolveFromWikipedia(
  match: Pick<Match, "homeTeam" | "awayTeam">,
  index: WikipediaIndex,
  knockout = false
): AuthoritativeResult {
  if (knockout) {
    const hit = index.knockoutByPair.get(pairKey(match.homeTeam, match.awayTeam));
    if (!hit) {
      return {
        found: false,
        source: "none",
        reasoning: "No finished knockout match for this pair on Wikipedia yet.",
      };
    }
    const sameOrientation = canon(hit.homeTeam) === canon(match.homeTeam);
    const homeScore = sameOrientation ? hit.homeScore : hit.awayScore;
    const awayScore = sameOrientation ? hit.awayScore : hit.homeScore;
    // Orient the advancer to the DB's home/away too.
    const advancer =
      hit.advancer == null
        ? null
        : sameOrientation
          ? hit.advancer
          : hit.advancer === "HOME"
            ? "AWAY"
            : "HOME";
    return {
      found: true,
      homeScore,
      awayScore,
      advancer,
      source: "wikipedia",
      reasoning: `Wikipedia knockout: ${hit.homeTeam} ${hit.homeScore}–${hit.awayScore} ${hit.awayTeam}${
        hit.advancer ? ` (${advancer === "HOME" ? match.homeTeam : match.awayTeam} advanced)` : ""
      }.`,
    };
  }

  const hit = index.byPair.get(pairKey(match.homeTeam, match.awayTeam));
  if (!hit) {
    return {
      found: false,
      source: "none",
      reasoning: "No finished match for this team pair on the Wikipedia group pages.",
    };
  }
  // Orient the source score to the DB's home team — Wikipedia may list the
  // teams in the opposite home/away order than we store them.
  const sameOrientation = canon(hit.homeTeam) === canon(match.homeTeam);
  const homeScore = sameOrientation ? hit.homeScore : hit.awayScore;
  const awayScore = sameOrientation ? hit.awayScore : hit.homeScore;
  return {
    found: true,
    homeScore,
    awayScore,
    source: "wikipedia",
    reasoning: `Wikipedia Group ${hit.group}: ${hit.homeTeam} ${hit.homeScore}–${hit.awayScore} ${hit.awayTeam}.`,
  };
}

/**
 * Authoritative result for a match: Wikipedia first (from the prebuilt index),
 * Gemini fallback when Wikipedia has nothing. Pass the index so a batch run
 * fetches the source pages only once.
 */
export async function fetchAuthoritativeResult(
  match: Match,
  index: WikipediaIndex
): Promise<AuthoritativeResult> {
  const knockout = isKnockout(match.groupLabel);
  const wiki = resolveFromWikipedia(match, index, knockout);
  if (wiki.found) return wiki;

  // Fallback: same source the app uses to settle. Lower trust, but better than
  // nothing before Wikipedia updates.
  try {
    const ai = await suggestMatchResult(match);
    if (
      ai.found &&
      typeof ai.homeScore === "number" &&
      typeof ai.awayScore === "number"
    ) {
      // Gemini gives the score but not the advancer. Derive it only when the
      // legal-time score is decisive; a draw (penalties) stays null → the
      // direction bets aren't auto-settled, just flagged.
      const advancer = knockout
        ? ai.homeScore > ai.awayScore
          ? "HOME"
          : ai.awayScore > ai.homeScore
            ? "AWAY"
            : null
        : undefined;
      return {
        found: true,
        homeScore: ai.homeScore,
        awayScore: ai.awayScore,
        advancer,
        source: "gemini",
        reasoning: `Wikipedia had no result; Gemini fallback: ${ai.reasoning}`,
      };
    }
    return {
      found: false,
      source: "none",
      reasoning: `Not on Wikipedia; Gemini also unconfirmed: ${ai.reasoning}`,
    };
  } catch (e) {
    return {
      found: false,
      source: "none",
      reasoning: `Not on Wikipedia; Gemini fallback errored: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
}
