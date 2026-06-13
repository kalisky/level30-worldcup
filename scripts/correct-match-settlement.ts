import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  matchBets,
  matches,
  rooms,
  users,
  type Match,
  type MatchBet,
} from "../lib/db/schema";
import { recordLedger } from "../lib/ledger";
import { touchMatchLiveRevisions } from "../lib/live-updates";
import { settleMatchBetsForRoom } from "../lib/settle-match-core";

type Options = {
  matchId: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
  homeScore: number;
  awayScore: number;
  dryRun: boolean;
};

type ExpectedBetSettlement = {
  directionOutcome: "won" | "lost";
  scoreOutcome: "won" | "lost";
  payout: number;
};

type RoomPlan = {
  roomId: string;
  roomCode: string;
  totalBets: number;
  settledBets: number;
  openBets: number;
  mismatchedSettledBets: number;
  shouldResetSettledBets: boolean;
  betsToSettle: number;
  payoutToReverse: number;
  expectedPayoutAfterRepair: number;
};

function usage() {
  console.log(
    [
      "Correct one match's final score and re-settle its bets across every room.",
      "",
      "Defaults target the Qatar vs Switzerland incident and correct it to 1-1.",
      "",
      "Usage:",
      "  npm run match:correct-settlement",
      "  npm run match:correct-settlement -- --dry-run",
      "  npm run match:correct-settlement -- --match-id <uuid> --home-score 1 --away-score 1",
      "",
      "Options:",
      "  --match-id <uuid>         Target a specific match id",
      "  --home-team <name>        Match home team (default: Qatar)",
      "  --away-team <name>        Match away team (default: Switzerland)",
      "  --kickoff <iso>           Narrow by kickoff timestamp when names are not unique",
      "  --home-score <int>        Correct final home score (default: 1)",
      "  --away-score <int>        Correct final away score (default: 1)",
      "  --dry-run                 Show the repair plan without writing",
    ].join("\n")
  );
}

function parseInteger(value: string | null, flag: string) {
  if (value == null) {
    throw new Error(`${flag} requires a value.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    matchId: null,
    homeTeam: "Qatar",
    awayTeam: "Switzerland",
    kickoff: null,
    homeScore: 1,
    awayScore: 1,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case "--match-id":
        options.matchId = argv[++i] ?? null;
        break;
      case "--home-team":
        options.homeTeam = (argv[++i] ?? "").trim() || options.homeTeam;
        break;
      case "--away-team":
        options.awayTeam = (argv[++i] ?? "").trim() || options.awayTeam;
        break;
      case "--kickoff":
        options.kickoff = argv[++i] ?? null;
        break;
      case "--home-score":
        options.homeScore = parseInteger(argv[++i] ?? null, "--home-score");
        break;
      case "--away-score":
        options.awayScore = parseInteger(argv[++i] ?? null, "--away-score");
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function expectedSettlementForBet(
  bet: MatchBet,
  homeScore: number,
  awayScore: number
): ExpectedBetSettlement {
  const actualDirection =
    homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : "DRAW";

  const directionWon = bet.directionPick === actualDirection;
  const scoreWon =
    bet.predictedHomeScore === homeScore && bet.predictedAwayScore === awayScore;

  const directionPayout = directionWon
    ? Math.floor(bet.directionStake * Number(bet.directionOddsLocked))
    : 0;
  const scorePayout = scoreWon
    ? Math.floor(bet.scoreStake * Number(bet.scoreOddsLocked))
    : 0;

  return {
    directionOutcome: directionWon ? "won" : "lost",
    scoreOutcome: scoreWon ? "won" : "lost",
    payout: directionPayout + scorePayout,
  };
}

function settledBetMatchesExpected(
  bet: MatchBet,
  expected: ExpectedBetSettlement
) {
  return (
    bet.status === "settled" &&
    bet.directionOutcome === expected.directionOutcome &&
    bet.scoreOutcome === expected.scoreOutcome &&
    (bet.payout ?? 0) === expected.payout
  );
}

function buildRoomPlan(args: {
  roomId: string;
  roomCode: string;
  bets: MatchBet[];
  homeScore: number;
  awayScore: number;
  correctionNeeded: boolean;
}): RoomPlan {
  const settledBets = args.bets.filter((bet) => bet.status === "settled");
  const openBets = args.bets.filter((bet) => bet.status === "open");
  const mismatchedSettledBets = settledBets.filter((bet) => {
    const expected = expectedSettlementForBet(
      bet,
      args.homeScore,
      args.awayScore
    );
    return !settledBetMatchesExpected(bet, expected);
  });

  // If the recorded match score is being corrected, reopen every settled bet
  // in the room so the new settlement is recomputed from a clean slate.
  const shouldResetSettledBets =
    settledBets.length > 0 &&
    (args.correctionNeeded || mismatchedSettledBets.length > 0);

  const betsToSettle = shouldResetSettledBets ? args.bets : openBets;

  return {
    roomId: args.roomId,
    roomCode: args.roomCode,
    totalBets: args.bets.length,
    settledBets: settledBets.length,
    openBets: openBets.length,
    mismatchedSettledBets: mismatchedSettledBets.length,
    shouldResetSettledBets,
    betsToSettle: betsToSettle.length,
    payoutToReverse: shouldResetSettledBets
      ? settledBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0)
      : 0,
    expectedPayoutAfterRepair: betsToSettle.reduce((sum, bet) => {
      return sum + expectedSettlementForBet(bet, args.homeScore, args.awayScore).payout;
    }, 0),
  };
}

function formatScore(
  homeScore: number | null,
  awayScore: number | null,
  status?: Match["status"]
) {
  if (homeScore == null || awayScore == null) {
    return status ? `${status} (no score)` : "no score";
  }
  return `${homeScore}-${awayScore}`;
}

async function findTargetMatch(options: Options) {
  if (options.matchId) {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, options.matchId))
      .limit(1);

    if (!match) {
      throw new Error(`No match found for id ${options.matchId}.`);
    }

    return match;
  }

  const candidates = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.homeTeam, options.homeTeam),
        eq(matches.awayTeam, options.awayTeam)
      )
    );

  const narrowed = options.kickoff
    ? candidates.filter(
        (match) =>
          new Date(match.kickoff).toISOString() ===
          new Date(options.kickoff as string).toISOString()
      )
    : candidates;

  if (narrowed.length === 0) {
    throw new Error(
      `No match found for ${options.homeTeam} vs ${options.awayTeam}.`
    );
  }

  if (narrowed.length > 1) {
    console.error("Multiple matches matched. Narrow with --match-id or --kickoff:");
    for (const match of narrowed) {
      console.error(
        `  ${match.id} ${match.homeTeam} vs ${match.awayTeam} @ ${new Date(
          match.kickoff
        ).toISOString()}`
      );
    }
    process.exit(1);
  }

  return narrowed[0];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetMatch = await findTargetMatch(options);
  const correctionNeeded =
    targetMatch.status !== "final" ||
    targetMatch.homeScore !== options.homeScore ||
    targetMatch.awayScore !== options.awayScore;

  const roomRows = await db
    .selectDistinct({
      roomId: matchBets.roomId,
      roomCode: rooms.code,
    })
    .from(matchBets)
    .innerJoin(rooms, eq(rooms.id, matchBets.roomId))
    .where(eq(matchBets.matchId, targetMatch.id))
    .orderBy(rooms.code);

  const betsByRoom = new Map<string, MatchBet[]>();
  for (const { roomId } of roomRows) {
    const roomBets = await db
      .select()
      .from(matchBets)
      .where(and(eq(matchBets.roomId, roomId), eq(matchBets.matchId, targetMatch.id)));
    betsByRoom.set(roomId, roomBets);
  }

  const roomPlans = roomRows.map(({ roomId, roomCode }) =>
    buildRoomPlan({
      roomId,
      roomCode,
      bets: betsByRoom.get(roomId) ?? [],
      homeScore: options.homeScore,
      awayScore: options.awayScore,
      correctionNeeded,
    })
  );

  const activePlans = roomPlans.filter(
    (plan) => plan.shouldResetSettledBets || plan.betsToSettle > 0
  );

  console.log(`Target match: ${targetMatch.id}`);
  console.log(
    `Fixture: ${targetMatch.homeTeam} vs ${targetMatch.awayTeam} @ ${new Date(
      targetMatch.kickoff
    ).toISOString()}`
  );
  console.log(
    `Recorded result: ${formatScore(
      targetMatch.homeScore,
      targetMatch.awayScore,
      targetMatch.status
    )}`
  );
  console.log(`Correct result: ${options.homeScore}-${options.awayScore}`);
  console.log(`Rooms with bets: ${roomRows.length}`);
  console.log(`Rooms needing work: ${activePlans.length}`);

  if (activePlans.length === 0 && !correctionNeeded) {
    console.log("Everything is already consistent with the requested score.");
    process.exit(0);
  }

  for (const plan of roomPlans) {
    console.log(
      [
        `- ${plan.roomCode}:`,
        `${plan.totalBets} bets`,
        `${plan.settledBets} settled`,
        `${plan.openBets} open`,
        `${plan.mismatchedSettledBets} mismatched`,
        plan.shouldResetSettledBets
          ? `reverse ${plan.payoutToReverse} chips, resettle ${plan.betsToSettle} bets`
          : plan.betsToSettle > 0
            ? `settle ${plan.betsToSettle} open bets`
            : "already consistent",
      ].join(" ")
    );
  }

  if (options.dryRun) {
    console.log("Dry run only. No changes were written.");
    process.exit(0);
  }

  const originalScoreLabel = formatScore(
    targetMatch.homeScore,
    targetMatch.awayScore,
    targetMatch.status
  );

  await db.transaction(async (tx) => {
    const correctedMatch =
      correctionNeeded
        ? (
            await tx
              .update(matches)
              .set({
                homeScore: options.homeScore,
                awayScore: options.awayScore,
                status: "final",
              })
              .where(eq(matches.id, targetMatch.id))
              .returning()
          )[0]
        : {
            ...targetMatch,
            homeScore: options.homeScore,
            awayScore: options.awayScore,
            status: "final" as const,
          };

    if (!correctedMatch) {
      throw new Error(`Failed to update match ${targetMatch.id}.`);
    }

    await touchMatchLiveRevisions(tx, correctedMatch.id);

    for (const plan of activePlans) {
      const roomBets = betsByRoom.get(plan.roomId) ?? [];
      const settledBets = roomBets.filter((bet) => bet.status === "settled");

      const members = await tx
        .select()
        .from(users)
        .where(eq(users.roomId, plan.roomId))
        .orderBy(asc(users.createdAt));
      const actor = members.find((member) => member.isCreator) ?? members[0];

      if (!actor) {
        throw new Error(`Room ${plan.roomCode} has no members to attribute the repair.`);
      }

      if (plan.shouldResetSettledBets) {
        for (const bet of settledBets) {
          const payoutToReverse = bet.payout ?? 0;

          if (payoutToReverse > 0) {
            const [updatedUser] = await tx
              .update(users)
              .set({ chips: sql`${users.chips} - ${payoutToReverse}` })
              .where(eq(users.id, bet.userId))
              .returning({ chips: users.chips });

            if (!updatedUser) {
              throw new Error(
                `Failed to reverse payout for bet ${bet.id} in room ${plan.roomCode}.`
              );
            }

            await recordLedger(tx, {
              roomId: plan.roomId,
              userId: bet.userId,
              delta: -payoutToReverse,
              balanceAfter: updatedUser.chips,
              reason: "match_bet_payout",
              refMatchId: correctedMatch.id,
              note: `Settlement correction - reversed incorrect payout from ${originalScoreLabel} before re-settling as ${options.homeScore}-${options.awayScore}`,
            });
          }
        }

        await tx
          .update(matchBets)
          .set({
            status: "open",
            directionOutcome: "pending",
            scoreOutcome: "pending",
            payout: null,
          })
          .where(
            and(
              eq(matchBets.roomId, plan.roomId),
              eq(matchBets.matchId, correctedMatch.id),
              eq(matchBets.status, "settled")
            )
          );
      }

      const result = await settleMatchBetsForRoom(tx, {
        roomId: plan.roomId,
        actorId: actor.id,
        match: correctedMatch,
        homeScore: options.homeScore,
        awayScore: options.awayScore,
        repair: true,
      });

      console.log(
        `Room ${plan.roomCode}: settled ${result.betsSettled} bets, reversed ${plan.payoutToReverse} chips, paid out ${result.totalPaidOut} chips`
      );
    }
  });

  console.log("Match settlement correction completed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Settlement correction failed:", error);
  process.exit(1);
});
