import { and, eq, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { matchBets, matches, rooms } from "@/lib/db/schema";
import { suggestMatchResult } from "@/lib/ai/suggest";
import { settleMatchBetsForRoom } from "@/lib/settle-match-core";
import { revalidateRoomChipPaths } from "@/lib/revalidate-room-chip-paths";

// A match can't be over before kickoff + 90' + half-time + stoppage (giving 10 minutes for the combined stoppage).
const MIN_MATCH_DURATION_MS = 115 * 60 * 1000;
// Re-ask the AI for an unconfirmed result at most this often, escalating the
// interval the longer the result stays unconfirmed so a match the AI can
// never resolve doesn't burn grounded-search quota forever:
//   first hour → every 10 min, first day → hourly, after that → daily.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Bound AI lookups per run for when several matches end together; the next
// run picks up whatever this one didn't get to.
const MAX_CHECKS_PER_RUN = 3;

function requiredCheckIntervalMs(checkableForMs: number) {
  if (checkableForMs < HOUR_MS) return CHECK_INTERVAL_MS;
  if (checkableForMs < DAY_MS) return HOUR_MS;
  return DAY_MS;
}

export type AutoSettleCheck = {
  matchId: string;
  match: string;
  found: boolean;
  reasoning: string;
  roomsSettled?: number;
  betsSettled?: number;
  totalPaidOut?: number;
};

export type AutoSettleResult = {
  status: "ok" | "noop";
  checked: AutoSettleCheck[];
};

/**
 * Server-side settlement: finds matches that should have finished, looks up
 * the official final score via AI + web search, and settles every room's
 * open bets on them. Users never settle matches themselves.
 *
 * Safe to call from any request (it's cheap when there's nothing to do) and
 * safe to call concurrently — each match is claimed by bumping
 * `resultLastCheckedAt` with a conditional update, and the settling
 * transaction re-checks the match status.
 */
export async function autoSettleFinishedMatches(options?: {
  force?: boolean;
}): Promise<AutoSettleResult> {
  const force = options?.force ?? false;
  const now = new Date();
  const finishedBy = new Date(now.getTime() - MIN_MATCH_DURATION_MS);
  const staleCheck = new Date(now.getTime() - CHECK_INTERVAL_MS);

  // Select with the loosest throttle (10 min) and apply the escalating
  // per-match backoff in JS — the interval depends on how long each match
  // has been checkable. Over-fetch so long-stuck matches can't crowd
  // fresher ones out of the per-run cap.
  const rawCandidates = await db
    .select()
    .from(matches)
    .where(
      and(
        ne(matches.status, "final"),
        lte(matches.kickoff, finishedBy),
        force
          ? undefined
          : or(
              isNull(matches.resultLastCheckedAt),
              lt(matches.resultLastCheckedAt, staleCheck)
            )
      )
    )
    .orderBy(matches.kickoff)
    .limit(MAX_CHECKS_PER_RUN * 4);

  const candidates = rawCandidates
    .filter((m) => {
      if (force || !m.resultLastCheckedAt) return true;
      const checkableForMs =
        now.getTime() -
        (new Date(m.kickoff).getTime() + MIN_MATCH_DURATION_MS);
      const sinceLastCheckMs =
        now.getTime() - new Date(m.resultLastCheckedAt).getTime();
      return sinceLastCheckMs >= requiredCheckIntervalMs(checkableForMs);
    })
    .slice(0, MAX_CHECKS_PER_RUN);

  if (candidates.length === 0) {
    return { status: "noop", checked: [] };
  }

  const checked: AutoSettleCheck[] = [];

  for (const match of candidates) {
    const label = `${match.homeTeam} vs ${match.awayTeam}`;

    // Claim the match for this run so concurrent requests don't all hit the
    // AI for the same match. Only one update wins per check interval.
    const claimed = await db
      .update(matches)
      .set({ resultLastCheckedAt: now })
      .where(
        and(
          eq(matches.id, match.id),
          ne(matches.status, "final"),
          force
            ? undefined
            : or(
                isNull(matches.resultLastCheckedAt),
                lt(matches.resultLastCheckedAt, staleCheck)
              )
        )
      )
      .returning({ id: matches.id });
    if (claimed.length === 0) continue;

    let result;
    try {
      result = await suggestMatchResult(match);
    } catch (e) {
      checked.push({
        matchId: match.id,
        match: label,
        found: false,
        reasoning: e instanceof Error ? e.message : "AI lookup failed.",
      });
      continue;
    }

    if (
      !result.found ||
      typeof result.homeScore !== "number" ||
      typeof result.awayScore !== "number" ||
      !Number.isInteger(result.homeScore) ||
      !Number.isInteger(result.awayScore) ||
      result.homeScore < 0 ||
      result.awayScore < 0 ||
      result.homeScore > 99 ||
      result.awayScore > 99
    ) {
      checked.push({
        matchId: match.id,
        match: label,
        found: false,
        reasoning: result.reasoning,
      });
      continue;
    }

    const homeScore = result.homeScore;
    const awayScore = result.awayScore;

    const settledRoomIds: string[] = [];
    let betsSettled = 0;
    let totalPaidOut = 0;

    await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, match.id))
        .limit(1);
      if (!fresh || fresh.status === "final") return;

      await tx
        .update(matches)
        .set({ homeScore, awayScore, status: "final" })
        .where(eq(matches.id, match.id));

      const roomsWithBets = await tx
        .selectDistinct({ roomId: matchBets.roomId })
        .from(matchBets)
        .where(
          and(eq(matchBets.matchId, match.id), eq(matchBets.status, "open"))
        );

      for (const { roomId } of roomsWithBets) {
        const res = await settleMatchBetsForRoom(tx, {
          roomId,
          actorId: null,
          match,
          homeScore,
          awayScore,
        });
        settledRoomIds.push(roomId);
        betsSettled += res.betsSettled;
        totalPaidOut += res.totalPaidOut;
      }
    });

    checked.push({
      matchId: match.id,
      match: label,
      found: true,
      reasoning: result.reasoning,
      roomsSettled: settledRoomIds.length,
      betsSettled,
      totalPaidOut,
    });

    // Best-effort cache invalidation; clients also pick the change up via
    // live-revision polling, and the room pages are dynamic.
    try {
      if (settledRoomIds.length > 0) {
        const codes = await db
          .select({ code: rooms.code })
          .from(rooms)
          .where(inArray(rooms.id, settledRoomIds));
        for (const { code } of codes) {
          revalidateRoomChipPaths(code);
          revalidatePath(`/r/${code}/match/${match.id}`);
          revalidatePath(`/r/${code}/admin`);
        }
      }
    } catch {
      // revalidation is unavailable in some calling contexts — ignore
    }
  }

  return { status: "ok", checked };
}
