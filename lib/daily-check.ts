// Morning verification cron. For every match that kicked off "yesterday"
// (Israel time), it checks the recorded score against an independent source
// (Wikipedia, via lib/result-oracle) and recomputes every settled bet's payout
// from the canonical math. Score-pull mismatches are auto-fixed (reverse +
// re-settle); chip-calculation discrepancies are reported for review. Each run
// is logged to the daily_checks table, surfaced at /admin/checks.

import { and, eq, gte, lte } from "drizzle-orm";
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
import {
  buildWikipediaIndex,
  fetchAuthoritativeResult,
  type WikipediaIndex,
} from "@/lib/result-oracle";

const ISRAEL_TZ = "Asia/Jerusalem";

/** The Israel calendar date (YYYY-MM-DD) for an instant. */
function israelDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Calendar date string N days before the given Israel day, DST-proof. */
function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86_400_000);
  return israelDateStrFromUTCDate(shifted);
}

function israelDateStrFromUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
 * Run the verification for one Israel day (defaults to yesterday). Persists a
 * daily_checks row and returns the summary.
 */
export async function runDailyCheck(options?: {
  /** Israel calendar date YYYY-MM-DD to verify. Defaults to yesterday. */
  date?: string;
  /** Server-side default: auto-fix score-pull mismatches. */
  autoFix?: boolean;
  now?: Date;
}): Promise<DailyCheckResult> {
  const autoFix = options?.autoFix ?? true;
  const now = options?.now ?? new Date();
  const checkDate = options?.date ?? shiftDateStr(israelDateStr(now), -1);

  try {
    const report = await verifyMatchesForDate(checkDate, autoFix);
    const issuesFound = report.matches.filter(
      (m) => m.verdict === "score-mismatch" || m.verdict === "chip-mismatch"
    ).length;
    const autoFixed = report.matches.filter(
      (m) => m.autoFix?.applied
    ).length;
    const status: DailyCheckResult["status"] =
      issuesFound > 0 ? "issues" : "ok";

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

async function verifyMatchesForDate(
  checkDate: string,
  autoFix: boolean
): Promise<DailyCheckReport> {
  // Over-fetch a ±2 day UTC window, then filter precisely by Israel calendar
  // day — avoids fiddly timezone-offset math while keeping the scan tiny.
  const [y, m, d] = checkDate.split("-").map(Number);
  const center = Date.UTC(y, m - 1, d);
  const lower = new Date(center - 2 * 86_400_000);
  const upper = new Date(center + 2 * 86_400_000);

  const windowMatches = await db
    .select()
    .from(matches)
    .where(and(gte(matches.kickoff, lower), lte(matches.kickoff, upper)));

  const dayMatches = windowMatches
    .filter((mt) => israelDateStr(new Date(mt.kickoff)) === checkDate)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  if (dayMatches.length === 0) {
    return { checkDate, matches: [] };
  }

  const index = await buildWikipediaIndex();

  const reports: DailyCheckMatchReport[] = [];
  for (const match of dayMatches) {
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

  // Couldn't confirm an independent result — surface it, change nothing.
  if (!auth.found || auth.homeScore == null || auth.awayScore == null) {
    return { ...base, verdict: "unverified" };
  }

  const scoreMatches =
    match.status === "final" &&
    match.homeScore === auth.homeScore &&
    match.awayScore === auth.awayScore;

  if (!scoreMatches) {
    // The recorded score is wrong or wasn't pulled at all.
    const report: DailyCheckMatchReport = { ...base, verdict: "score-mismatch" };
    if (autoFix) {
      try {
        const fix = await correctMatchSettlement(db, {
          match,
          homeScore: auth.homeScore,
          awayScore: auth.awayScore,
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
      auth.awayScore
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
