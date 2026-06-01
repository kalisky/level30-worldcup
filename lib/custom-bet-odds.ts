import { eq } from "drizzle-orm";
import { generateCustomBetOdds, generateOpenAnswerOdds } from "@/lib/ai/odds";
import { db } from "@/lib/db";
import { customBets, matches, type CustomBet, type CustomBetOption } from "@/lib/db/schema";
import { touchRoomLiveRevision } from "@/lib/live-updates";

const CUSTOM_BET_ODDS_TTL_MS = 24 * 60 * 60 * 1000;

type OddsExecutor = Pick<typeof db, "insert" | "select" | "update">;
type MatchContext = Parameters<typeof generateCustomBetOdds>[0]["matchContext"];

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findOptionIdxByAnswer(
  options: CustomBetOption[],
  answer: string
): number {
  const normalizedAnswer = normalizeAnswer(answer);
  return options.findIndex(
    (option) => normalizeAnswer(option.label) === normalizedAnswer
  );
}

export function stampCustomBetOption(
  option: CustomBetOption,
  generatedAt: Date = new Date()
): CustomBetOption {
  return {
    ...option,
    generatedAt: generatedAt.toISOString(),
  };
}

export function stampCustomBetOptions(
  options: CustomBetOption[],
  generatedAt: Date = new Date()
): CustomBetOption[] {
  return options.map((option) => stampCustomBetOption(option, generatedAt));
}

export function isCustomBetOptionStale(
  option: CustomBetOption,
  nowMs: number = Date.now()
) {
  const generatedAtMs = option.generatedAt
    ? new Date(option.generatedAt).getTime()
    : Number.NaN;

  return !Number.isFinite(generatedAtMs) || nowMs - generatedAtMs >= CUSTOM_BET_ODDS_TTL_MS;
}

export async function getCustomBetMatchContext(
  matchId: string | undefined,
  executor: Pick<typeof db, "select"> = db,
  options: {
    requireMatch?: boolean;
    requireNonFinal?: boolean;
  } = {}
): Promise<MatchContext> {
  if (!matchId) return undefined;

  const [match] = await executor
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    if (options.requireMatch) {
      throw new Error("Match not found.");
    }
    return undefined;
  }

  if (options.requireNonFinal && match.status === "final") {
    throw new Error("Cannot propose a custom bet on a final match.");
  }

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    groupLabel: match.groupLabel,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    kickoff: new Date(match.kickoff),
  };
}

async function persistCustomBetOdds(
  executor: OddsExecutor,
  bet: CustomBet,
  options: CustomBetOption[],
  aiReasoning?: string
) {
  if (typeof aiReasoning === "string") {
    await executor
      .update(customBets)
      .set({ options, aiReasoning })
      .where(eq(customBets.id, bet.id));
  } else {
    await executor
      .update(customBets)
      .set({ options })
      .where(eq(customBets.id, bet.id));
  }

  await touchRoomLiveRevision(executor, bet.roomId);
}

export async function ensureFreshCustomBetOdds(
  executor: OddsExecutor,
  bet: CustomBet
): Promise<CustomBet> {
  const nowMs = Date.now();

  if (bet.status !== "open") return bet;
  if (bet.options.length === 0) return bet;
  if (bet.locksAt && new Date(bet.locksAt).getTime() <= nowMs) {
    return bet;
  }

  if (bet.kind === "fixed_options") {
    if (!bet.options.some((option) => isCustomBetOptionStale(option, nowMs))) {
      return bet;
    }

    const matchContext = await getCustomBetMatchContext(bet.matchId ?? undefined, executor);
    const refreshedAt = new Date();
    const aiResult = await generateCustomBetOdds({
      matchContext,
      title: bet.title,
      description: bet.description,
      optionLabels: bet.options.map((option) => option.label),
    });
    const refreshedOptions = stampCustomBetOptions(aiResult.options, refreshedAt);

    await persistCustomBetOdds(executor, bet, refreshedOptions, aiResult.reasoning);

    return {
      ...bet,
      options: refreshedOptions,
      aiReasoning: aiResult.reasoning,
    };
  }

  const staleIndexes = new Set<number>();
  bet.options.forEach((option, index) => {
    if (isCustomBetOptionStale(option, nowMs)) {
      staleIndexes.add(index);
    }
  });

  if (staleIndexes.size === 0) return bet;

  const matchContext = await getCustomBetMatchContext(bet.matchId ?? undefined, executor);
  const refreshedAt = new Date();
  const refreshedOptions = await Promise.all(
    bet.options.map(async (option, index) => {
      if (!staleIndexes.has(index)) {
        return option;
      }

      const aiResult = await generateOpenAnswerOdds({
        matchContext,
        title: bet.title,
        description: bet.description,
        answer: option.label,
        existingAnswers: bet.options
          .filter((_, optionIndex) => optionIndex !== index)
          .map((entry) => entry.label),
      });

      return stampCustomBetOption(
        {
          label: option.label,
          probability: aiResult.probability,
          odds: aiResult.odds,
        },
        refreshedAt
      );
    })
  );

  await persistCustomBetOdds(executor, bet, refreshedOptions);

  return {
    ...bet,
    options: refreshedOptions,
  };
}
