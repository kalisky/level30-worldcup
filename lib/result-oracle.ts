// Authoritative final-score lookup for the verification cron. Wikipedia (an
// independent source) is primary; the app's own Gemini+Search settler is the
// fallback only when Wikipedia hasn't published a confirmed result yet (or for
// knockout fixtures, which aren't on the group pages).

import type { Match } from "@/lib/db/schema";
import {
  fetchAllGroupResults,
  type WikipediaMatchResult,
} from "@/lib/wikipedia-results";
import { suggestMatchResult } from "@/lib/ai/suggest";

export type AuthoritativeResult = {
  found: boolean;
  /** Oriented to the DB match's HOME team, not the source's home designation. */
  homeScore?: number;
  awayScore?: number;
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
  errors: { group: string; error: string }[];
};

/** Index parsed results by team pair (exported for testing). */
export function indexResults(
  results: WikipediaMatchResult[],
  errors: { group: string; error: string }[] = []
): WikipediaIndex {
  const byPair = new Map<string, WikipediaMatchResult>();
  for (const r of results) {
    byPair.set(pairKey(r.homeTeam, r.awayTeam), r);
  }
  return { byPair, errors };
}

/** Fetch every group page once and index finished matches by team pair. */
export async function buildWikipediaIndex(): Promise<WikipediaIndex> {
  const { results, errors } = await fetchAllGroupResults();
  return indexResults(results, errors);
}

/** Resolve one match from a prebuilt Wikipedia index, oriented to DB home/away. */
export function resolveFromWikipedia(
  match: Pick<Match, "homeTeam" | "awayTeam">,
  index: WikipediaIndex
): AuthoritativeResult {
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
 * fetches the group pages only once.
 */
export async function fetchAuthoritativeResult(
  match: Match,
  index: WikipediaIndex
): Promise<AuthoritativeResult> {
  const wiki = resolveFromWikipedia(match, index);
  if (wiki.found) return wiki;

  // Fallback: same source the app uses to settle. Lower trust, but better than
  // nothing for knockout fixtures or before Wikipedia updates.
  try {
    const ai = await suggestMatchResult(match);
    if (
      ai.found &&
      typeof ai.homeScore === "number" &&
      typeof ai.awayScore === "number"
    ) {
      return {
        found: true,
        homeScore: ai.homeScore,
        awayScore: ai.awayScore,
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
