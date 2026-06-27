// Morning verification cron (runs ~07:00 Israel). It verifies every match that
// has *finished* since the previous check — independent of calendar date, since
// a single night's World Cup slate (games are in the Americas) straddles Israel
// midnight. For each finished match it checks the recorded score against an
// independent source (Wikipedia, via lib/result-oracle) and recomputes every
// bet's payout from the canonical math. Score-pull mismatches (wrong score, or
// a finished match we never settled) are auto-fixed (settle / reverse +
// re-settle); chip-calculation discrepancies are reported for review.
//
// A match still in progress at run time (e.g. one ending ~09:00 Israel) isn't
// "done" yet, so it's skipped this run and picked up the next morning — by
// which point users have long seen the corrected state of everything that
// finished overnight. De-duplication against recent checks means each match is
// reported once and nothing is missed across the midnight boundary.
//
// Each run is logged to the daily_checks table, surfaced at /admin/checks.

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyChecks,
  matchBets,
  matches,
  type DailyCheckMatchReport,
  type DailyCheckReport,
  type Match,
} from "@/lib/db/schema";
import { computeMatchBetSettlement } from "@/lib/settle-match-core";
import { correctMatchSettlement } from "@/lib/correct-settlement";
import { isKnockout } from "@/lib/knockout";
import {
  buildWikipediaIndex,
  fetchAuthoritativeResult,
  type WikipediaIndex,
} from "@/lib/result-oracle";

const ISRAEL_TZ = "Asia/Jerusalem";

// A match can't be over before kickoff + 90' + half-time + stoppage. Matches
// this the auto-settler's threshold: before this elapses we don't trust any
// "final" score (and Wikipedia might still show a live score).
const MIN_MATCH_DURATION_MS = 115 * 60 * 1000;
// How far back to scan for finished-but-unverified matches. Comfortably longer
// than the daily cadence so a match that wasn't done at one run is still in
// range at the next — de-dup stops it being re-reported once handled.
const SCAN_WINDOW_MS = 72 * 60 * 60 * 1000;
// How far back to read prior checks when building the "already handled" set.
const DEDUP_LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;

/** The Israel calendar date (YYYY-MM-DD) for an instant — used only as a label. */
function israelDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function scoreStr(home: number | null, away: number | null): string | null {
  if (home == null || away == null) return null;
  return `${home}-${away}`;
}

export type DailyCheckResult = {
  id: string;
  checkDate: string;
  status: "ok" | "issues" | "error";
  matchesChecked: number;
  issuesFound: number;
  autoFixed: number;
  report: DailyCheckReport;
};

/**
 * Verify every match finished since the previous check and persist a
 * daily_checks row. Auto-fixes score-pull mismatches by default.
 */
export async function runDailyCheck(options?: {
  autoFix?: boolean;
  now?: Date;
  /** Re-verify matches already confirmed by a prior run (default false). */
  force?: boolean;
}): Promise<DailyCheckResult> {
  const autoFix = options?.autoFix ?? true;
  const now = options?.now ?? new Date();
  const checkDate = israelDateStr(now);

  try {
    const report = await verifyFinishedMatches(now, autoFix, options?.force ?? false);
    const issuesFound = report.matches.filter(
      (m) => m.verdict === "score-mismatch" || m.verdict === "chip-mismatch"
    ).length;
    const autoFixed = report.matches.filter((m) => m.autoFix?.applied).length;
    const status: DailyCheckResult["status"] = issuesFound > 0 ? "issues" : "ok";

    const [row] = await db
      .insert(dailyChecks)
      .values({
        checkDate,
        status,
        matchesChecked: report.matches.length,
        issuesFound,
        autoFixed,
        report,
      })
      .returning({ id: dailyChecks.id });

    return {
      id: row.id,
      checkDate,
      status,
      matchesChecked: report.matches.length,
      issuesFound,
      autoFixed,
      report,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const report: DailyCheckReport = { checkDate, matches: [], error: message };
    const [row] = await db
      .insert(dailyChecks)
      .values({
        checkDate,
        status: "error",
        matchesChecked: 0,
        issuesFound: 0,
        autoFixed: 0,
        report,
      })
      .returning({ id: dailyChecks.id });
    return {
      id: row.id,
      checkDate,
      status: "error",
      matchesChecked: 0,
      issuesFound: 0,
      autoFixed: 0,
      report,
    };
  }
}

/** matchIds already confirmed correct (or successfully auto-fixed) by a prior run. */
async function loadHandledMatchIds(now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - DEDUP_LOOKBACK_MS);
  const prior = await db
    .select({ report: dailyChecks.report })
    .from(dailyChecks)
    .where(gte(dailyChecks.ranAt, since))
    .orderBy(desc(dailyChecks.ranAt));

  const handled = new Set<string>();
  for (const row of prior) {
    for (const m of row.report?.matches ?? []) {
      // "Done" = nothing more to do: verified correct, had no bets, or the
      // score mismatch was auto-fixed. Leave "unverified" and "chip-mismatch"
      // out so they keep being re-checked until resolved.
      if (m.verdict === "ok" || m.verdict === "no-bets" || m.autoFix?.applied) {
        handled.add(m.matchId);
      }
    }
  }
  return handled;
}

async function verifyFinishedMatches(
  now: Date,
  autoFix: boolean,
  force: boolean
): Promise<DailyCheckReport> {
  const checkDate = israelDateStr(now);
  const doneBy = new Date(now.getTime() - MIN_MATCH_DURATION_MS);
  const scanFrom = new Date(now.getTime() - SCAN_WINDOW_MS);

  // Candidates: anything that should be over by now (kickoff + 115' <= now),
  // within the scan window. Includes non-final matches so a finished game the
  // auto-settler missed still gets settled here.
  const candidates = await db
    .select()
    .from(matches)
    .where(and(gte(matches.kickoff, scanFrom), lte(matches.kickoff, doneBy)))
    .orderBy(matches.kickoff);

  const handled = force ? new Set<string>() : await loadHandledMatchIds(now);
  const todo = candidates.filter((m) => !handled.has(m.id));

  if (todo.length === 0) {
    return { checkDate, matches: [] };
  }

  const index = await buildWikipediaIndex();

  const reports: DailyCheckMatchReport[] = [];
  for (const match of todo) {
    reports.push(await verifyMatch(match, index, autoFix));
  }
  return { checkDate, matches: reports };
}

async function verifyMatch(
  match: Match,
  index: WikipediaIndex,
  autoFix: boolean
): Promise<DailyCheckMatchReport> {
  const label = `${match.homeTeam} vs ${match.awayTeam}`;
  const storedScore = scoreStr(match.homeScore, match.awayScore);
  const knockout = isKnockout(match.groupLabel);

  const auth = await fetchAuthoritativeResult(match, index);

  const base: DailyCheckMatchReport = {
    matchId: match.id,
    match: label,
    kickoff: new Date(match.kickoff).toISOString(),
    storedScore,
    authoritativeScore:
      auth.found && auth.homeScore != null && auth.awayScore != null
        ? `${auth.homeScore}-${auth.awayScore}`
        : null,
    verified: auth.found,
    verdict: "ok",
    reasoning: auth.reasoning,
    betsChecked: 0,
  };

  // Couldn't confirm an independent result — surface it, change nothing. Stays
  // out of the "handled" set, so it's retried next run.
  if (!auth.found || auth.homeScore == null || auth.awayScore == null) {
    return { ...base, verdict: "unverified" };
  }

  // Knockout level after extra time but the shootout winner isn't confirmed yet
  // — can't decide the direction bets, so leave it for the next run.
  if (knockout && auth.homeScore === auth.awayScore && auth.advancer == null) {
    return { ...base, verdict: "unverified" };
  }

  const scoreMatches =
    match.status === "final" &&
    match.homeScore === auth.homeScore &&
    match.awayScore === auth.awayScore &&
    (!knockout || match.advancer === auth.advancer);

  if (!scoreMatches) {
    // The recorded score/advancer is wrong, or the match finished unsettled.
    const report: DailyCheckMatchReport = { ...base, verdict: "score-mismatch" };
    if (autoFix) {
      try {
        const fix = await correctMatchSettlement(db, {
          match,
          homeScore: auth.homeScore,
          awayScore: auth.awayScore,
          advancer: knockout ? auth.advancer ?? null : null,
          actorIdForRoom: () => null, // server / automated correction
        });
        report.autoFix = {
          applied: true,
          fromScore: fix.fromScore,
          toScore: fix.toScore,
          roomsResettled: fix.roomsResettled,
          betsResettled: fix.betsResettled,
          chipsReversed: fix.chipsReversed,
          chipsPaidOut: fix.chipsPaidOut,
        };
      } catch (e) {
        report.autoFix = {
          applied: false,
          fromScore: storedScore,
          toScore: `${auth.homeScore}-${auth.awayScore}`,
          roomsResettled: 0,
          betsResettled: 0,
          chipsReversed: 0,
          chipsPaidOut: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    return report;
  }

  // Score is correct — verify the chip math on every bet for this match.
  const bets = await db
    .select()
    .from(matchBets)
    .where(eq(matchBets.matchId, match.id));

  const discrepancies: NonNullable<
    DailyCheckMatchReport["chipDiscrepancies"]
  > = [];

  for (const bet of bets) {
    const expected = computeMatchBetSettlement(
      bet,
      auth.homeScore,
      auth.awayScore,
      { knockout, advancer: knockout ? auth.advancer ?? null : null }
    );
    // A bet still open on a final, verified match never got settled.
    const stillOpen = bet.status === "open";
    const mismatched =
      stillOpen ||
      bet.directionOutcome !== expected.directionOutcome ||
      bet.scoreOutcome !== expected.scoreOutcome ||
      (bet.payout ?? 0) !== expected.payout;
    if (mismatched) {
      discrepancies.push({
        betId: bet.id,
        roomId: bet.roomId,
        userId: bet.userId,
        storedPayout: bet.payout,
        expectedPayout: expected.payout,
        storedDirectionOutcome: stillOpen ? "open" : bet.directionOutcome,
        expectedDirectionOutcome: expected.directionOutcome,
        storedScoreOutcome: stillOpen ? "open" : bet.scoreOutcome,
        expectedScoreOutcome: expected.scoreOutcome,
      });
    }
  }

  if (bets.length === 0) {
    return { ...base, verdict: "no-bets", betsChecked: 0 };
  }
  if (discrepancies.length > 0) {
    return {
      ...base,
      verdict: "chip-mismatch",
      betsChecked: bets.length,
      chipDiscrepancies: discrepancies,
    };
  }
  return { ...base, verdict: "ok", betsChecked: bets.length };
}
