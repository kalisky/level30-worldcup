import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customBets, matches } from "@/lib/db/schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FALLBACK_DEFAULT_BETS_LOCK = new Date("2026-06-17T23:00:00Z");

// Each default bet is identified by `defaultKey`, which is what the renderer
// uses to pull the localized title/description. The stored `title` /
// `description` are an English fallback used only when no translation is found.
export const DEFAULT_BET_KEYS = ["tournament_winner", "top_scorer"] as const;
export type DefaultBetKey = (typeof DEFAULT_BET_KEYS)[number];

const FALLBACK_COPY: Record<DefaultBetKey, { title: string; description: string }> = {
  tournament_winner: {
    title: "Tournament winner",
    description: "Who will win the 2026 World Cup?",
  },
  top_scorer: {
    title: "Top scorer",
    description: "Who will finish as the tournament's top scorer (Golden Boot)?",
  },
};

/**
 * Lock time for the seeded default bets ("Tournament winner" / "Top scorer"):
 * the first match kickoff that happens strictly after every group has played
 * its first match. At that point each group has finished its opener and
 * players have enough signal to commit to a pre-tournament prediction.
 */
export async function getDefaultBetsLockTime(
  executor: Db | Tx = db
): Promise<Date> {
  const [row] = await executor.execute<{ lock_at: Date | string | null }>(sql`
    WITH firsts AS (
      SELECT MIN(kickoff) AS k
      FROM matches
      WHERE group_label IS NOT NULL
      GROUP BY group_label
    ),
    last_opener AS (SELECT MAX(k) AS k FROM firsts)
    SELECT MIN(kickoff) AS lock_at
    FROM matches, last_opener
    WHERE kickoff > last_opener.k
  `);
  if (!row?.lock_at) return FALLBACK_DEFAULT_BETS_LOCK;
  const v = row.lock_at;
  return v instanceof Date ? v : new Date(v);
}

export async function seedDefaultCustomBets(
  executor: Db | Tx,
  args: { roomId: string; proposerId: string; locksAt: Date }
) {
  const existing = await executor
    .select({ defaultKey: customBets.defaultKey })
    .from(customBets)
    .where(eq(customBets.roomId, args.roomId));
  const present = new Set(existing.map((r) => r.defaultKey));

  for (const key of DEFAULT_BET_KEYS) {
    if (present.has(key)) continue;

    await executor.insert(customBets).values({
      roomId: args.roomId,
      matchId: null,
      proposerId: args.proposerId,
      title: FALLBACK_COPY[key].title,
      description: FALLBACK_COPY[key].description,
      defaultKey: key,
      kind: "open_question",
      options: [],
      aiReasoning: "",
      status: "open",
      locksAt: args.locksAt,
    });
  }
}
