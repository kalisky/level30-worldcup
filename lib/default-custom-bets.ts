import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customBets, matches } from "@/lib/db/schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FALLBACK_TOURNAMENT_START = new Date("2026-06-11T16:00:00Z");

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

export async function getTournamentStart(executor: Db | Tx = db): Promise<Date> {
  const [first] = await executor
    .select({ kickoff: matches.kickoff })
    .from(matches)
    .orderBy(asc(matches.kickoff))
    .limit(1);
  return first?.kickoff ?? FALLBACK_TOURNAMENT_START;
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
