// Keeps the Round of 32 fixtures in sync with the Wikipedia knockout-stage
// page. In the 48-team format the bracket fills in over time (best-third-place
// allocation, then later rounds), so opponents start as placeholders like
// "3rd Group C/E" and resolve to real nations later. This sync:
//   - inserts each fixture once BOTH teams are real, generating its odds then,
//   - removes bet-free placeholder rows,
//   - never touches a match that already has bets.
// Safe to run repeatedly (cron + the seed script both call it).

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchBets, matches } from "@/lib/db/schema";
import { generateKnockoutOdds } from "@/lib/ai/odds";
import { isPlaceholderTeam, KNOCKOUT_ROUNDS } from "@/lib/knockout";

const KNOCKOUT_URL =
  "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage";

// 48-team bracket match numbers → round labels (see data/knockout_bracket.json).
function roundForMatchNo(n: number): string | null {
  if (n >= 73 && n <= 88) return "R32";
  if (n >= 89 && n <= 96) return "R16";
  if (n >= 97 && n <= 100) return "QF";
  if (n >= 101 && n <= 102) return "SF";
  if (n === 103) return "3RD";
  if (n === 104) return "F";
  return null;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
function cellText(html: string): string {
  return decode(html.replace(/<[^>]*>/g, " ").replace(/\[[^\]]*\]/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
function firstCell(block: string, cls: string): string {
  const m = new RegExp(
    `class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</(?:th|td|div)>`
  ).exec(block);
  return m ? m[1] : "";
}

function canon(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    unitedstates: "usa",
    us: "usa",
    czechrepublic: "czechia",
    iriran: "iran",
    korearepublic: "southkorea",
  };
  return aliases[n] ?? n;
}
function pairKey(a: string, b: string): string {
  return [canon(a), canon(b)].sort().join("|");
}

export type KnockoutFixture = {
  matchNo: number;
  round: string; // "R32" | "R16" | "QF" | "SF" | "3RD" | "F"
  home: string;
  away: string;
  kickoff: Date;
};

/** Combine fdate ("… 2026-06-28 …") + ftime ("12:00 p.m. UTC−7") into UTC. */
function parseKickoff(fdateText: string, ftimeText: string): Date | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(fdateText);
  const tm = /(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*UTC\s*([+−-])\s*(\d{1,2})/i.exec(
    ftimeText
  );
  if (!iso || !tm) return null;
  let hour = Number(tm[1]);
  const min = Number(tm[2]);
  const pm = tm[3].toLowerCase() === "p";
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  const offset = (tm[4] === "+" ? 1 : -1) * Number(tm[5]);
  return new Date(
    Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), hour - offset, min)
  );
}

/** Fetch + parse every knockout fixture (R32 → Final), placeholders included. */
export async function fetchKnockoutFixtures(): Promise<KnockoutFixture[]> {
  const res = await fetch(KNOCKOUT_URL, {
    headers: { "User-Agent": "Mozilla/5.0 wc-knockout-sync" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wikipedia knockout page HTTP ${res.status}`);
  const html = await res.text();
  const blocks = html.split(/class="[^"]*\bfootballbox\b[^"]*"/);
  const out: KnockoutFixture[] = [];
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i].slice(0, 6000);
    const home = cellText(firstCell(b, "fhome"));
    const away = cellText(firstCell(b, "faway"));
    // Before kickoff the score cell reads "Match NN"; after, it's the score —
    // either way the match-number label is what we key the round off of.
    const mn = /Match\s+(\d+)/i.exec(cellText(firstCell(b, "fscore")));
    if (!home || !away || !mn) continue;
    const matchNo = Number(mn[1]);
    const round = roundForMatchNo(matchNo);
    if (!round) continue;
    const kickoff = parseKickoff(
      cellText(firstCell(b, "fdate")),
      cellText(firstCell(b, "ftime"))
    );
    if (!kickoff) continue;
    out.push({ matchNo, round, home, away, kickoff });
  }
  return out.sort((a, b) => a.matchNo - b.matchNo);
}

export type KnockoutSyncResult = {
  fetched: number;
  resolved: number; // fixtures with both teams real
  inserted: { home: string; away: string }[];
  removedPlaceholders: number;
  oddsGenerated: number;
  errors: string[];
};

/**
 * Sync every knockout round (R32 → Final) from Wikipedia. Inserts each fixture
 * once both teams are real, with freshly generated odds, and prunes bet-free
 * placeholder rows. As each round finishes, the next round's fixtures resolve
 * and get picked up here — no manual step per round.
 */
export async function syncKnockoutFixtures(options?: {
  /** Skip Gemini odds (rows only). */
  rowsOnly?: boolean;
  /** Map a Wikipedia team name to the name already used in the DB. */
  normalizeTeam?: (name: string) => string;
}): Promise<KnockoutSyncResult> {
  const result: KnockoutSyncResult = {
    fetched: 0,
    resolved: 0,
    inserted: [],
    removedPlaceholders: 0,
    oddsGenerated: 0,
    errors: [],
  };

  const fixtures = await fetchKnockoutFixtures();
  result.fetched = fixtures.length;

  // Default normalizer: map Wikipedia names to the names already in the DB
  // (so flags + i18n match), built from every existing fixture's teams.
  let normalize = options?.normalizeTeam;
  if (!normalize) {
    const allTeams = await db
      .select({ home: matches.homeTeam, away: matches.awayTeam })
      .from(matches);
    const byCanon = new Map<string, string>();
    for (const r of allTeams) {
      byCanon.set(canon(r.home), r.home);
      byCanon.set(canon(r.away), r.away);
    }
    normalize = (name: string) => byCanon.get(canon(name)) ?? name;
  }

  const existing = await db
    .select()
    .from(matches)
    .where(inArray(matches.groupLabel, [...KNOCKOUT_ROUNDS]));
  const existingByPair = new Map(
    existing.map((m) => [pairKey(m.homeTeam, m.awayTeam), m])
  );

  // Prune bet-free placeholder rows (stale or never-bettable).
  const placeholderRows = existing.filter(
    (m) => isPlaceholderTeam(m.homeTeam) || isPlaceholderTeam(m.awayTeam)
  );
  if (placeholderRows.length > 0) {
    const ids = placeholderRows.map((m) => m.id);
    const withBets = await db
      .select({ matchId: matchBets.matchId })
      .from(matchBets)
      .where(inArray(matchBets.matchId, ids));
    const betMatchIds = new Set(withBets.map((b) => b.matchId));
    const removable = ids.filter((id) => !betMatchIds.has(id));
    if (removable.length > 0) {
      await db.delete(matches).where(inArray(matches.id, removable));
      result.removedPlaceholders = removable.length;
    }
  }

  for (const f of fixtures) {
    if (isPlaceholderTeam(f.home) || isPlaceholderTeam(f.away)) continue; // not resolved yet
    result.resolved += 1;
    const home = normalize(f.home);
    const away = normalize(f.away);
    if (existingByPair.has(pairKey(home, away))) continue; // already seeded

    const [row] = await db
      .insert(matches)
      .values({ groupLabel: f.round, homeTeam: home, awayTeam: away, kickoff: f.kickoff })
      .returning({ id: matches.id });
    result.inserted.push({ home, away });

    if (!options?.rowsOnly) {
      try {
        const odds = await generateKnockoutOdds({
          homeTeam: home,
          awayTeam: away,
          roundLabel: f.round,
          kickoff: f.kickoff,
        });
        await db
          .update(matches)
          .set({
            oddsHome: odds.oddsHome.toFixed(2),
            oddsAway: odds.oddsAway.toFixed(2),
            oddsDraw: null,
            scoreOdds: odds.scoreOdds,
            oddsLastSyncedAt: new Date(),
            oddsLastSyncStatus: "success",
          })
          .where(eq(matches.id, row.id));
        result.oddsGenerated += 1;
      } catch (e) {
        result.errors.push(
          `odds ${home} vs ${away}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  return result;
}
