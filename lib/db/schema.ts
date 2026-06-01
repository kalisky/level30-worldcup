import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  numeric,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "live",
  "final",
]);

export const matchBetStatus = pgEnum("match_bet_status", [
  "open",
  "settled",
  "void",
]);

export const outcome = pgEnum("outcome", ["pending", "won", "lost"]);

export const wagerStatus = pgEnum("wager_status", [
  "open",
  "won",
  "lost",
  "void",
]);

export const customBetStatus = pgEnum("custom_bet_status", [
  "open",
  "locked",
  "settled",
  "void",
]);

export const customBetKind = pgEnum("custom_bet_kind", [
  "fixed_options",   // proposer specifies 2–5 options up front; odds normalized to sum to 1
  "open_question",   // free-form answers from any user; each answer cached with its own odds independently
]);

export const settlementKind = pgEnum("settlement_kind", [
  "match",
  "custom_bet",
  "void_custom_bet",
]);

export const oddsSyncStatus = pgEnum("odds_sync_status", [
  "running",
  "success",
  "partial_success",
  "skipped",
  "error",
]);

export const oddsSnapshotMarket = pgEnum("odds_snapshot_market", [
  "winner",
  "correct_score",
]);

export const ledgerReason = pgEnum("ledger_reason", [
  "opening_balance",       // one-time backfill row when feature shipped
  "initial",               // chips granted when user joins/created
  "daily_grant",           // daily top-up
  "match_bet_placed",      // -stake when placing a match bet
  "match_bet_payout",      // +payout when match settles in your favor
  "custom_wager_placed",   // -stake when wagering on custom bet
  "custom_wager_payout",   // +payout when custom bet settles in your favor
  "custom_wager_refund",   // +stake when custom bet is voided
]);

export const authUsers = pgTable(
  "auth_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firebaseUid: text("firebase_uid").notNull().unique(),
    email: text("email"),
    googleName: text("google_name"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    defaultRoomId: uuid("default_room_id").references((): AnyPgColumn => rooms.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("auth_users_display_name_idx").on(t.displayName)]
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("auth_sessions_user_idx").on(t.authUserId),
    index("auth_sessions_expires_idx").on(t.expiresAt),
  ]
);

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  creatorAuthUserId: uuid("creator_auth_user_id").references(() => authUsers.id, {
    onDelete: "restrict",
  }),
  startingChips: integer("starting_chips").notNull().default(1000),
  maxMembers: integer("max_members").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    authUserId: uuid("auth_user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    chips: integer("chips").notNull(),
    isCreator: boolean("is_creator").notNull().default(false),
    // Last time the user received their daily top-up. NULL means never; the
    // grant logic in requireRoomUser uses this to gate one credit per ~day.
    lastDailyGrantAt: timestamp("last_daily_grant_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("users_room_idx").on(t.roomId),
    index("users_auth_user_idx").on(t.authUserId),
    uniqueIndex("users_room_auth_user_idx").on(t.roomId, t.authUserId),
  ]
);

// Score odds cache shape:
//   { "0-0": 9.12, "1-0": 7.40, "1-1": 6.20, ... }  — sparse decimal odds keyed
//   by the exact scorelines currently offered by the source market.
export type ScoreOddsCache = Record<string, number>;

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupLabel: text("group_label").notNull(), // 'A'..'L' or 'R16'/'QF'/'SF'/'F'/'3RD'
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
    status: matchStatus("status").notNull().default("scheduled"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    // Direction (1X2) decimal odds — generated by Claude.
    oddsHome: numeric("odds_home", { precision: 5, scale: 2 }),
    oddsDraw: numeric("odds_draw", { precision: 5, scale: 2 }),
    oddsAway: numeric("odds_away", { precision: 5, scale: 2 }),
    // Exact-score decimal odds for the currently offered scorelines.
    // null if not yet synced.
    scoreOdds: jsonb("score_odds").$type<ScoreOddsCache>(),
    oddsSourceWinnerUrl: text("odds_source_winner_url"),
    oddsSourceCorrectScoreUrl: text("odds_source_correct_score_url"),
    oddsLastSyncedAt: timestamp("odds_last_synced_at", { withTimezone: true }),
    oddsLastSyncStatus: oddsSyncStatus("odds_last_sync_status"),
    oddsLastSyncError: text("odds_last_sync_error"),
  },
  (t) => [
    index("matches_kickoff_idx").on(t.kickoff),
    index("matches_status_idx").on(t.status),
  ]
);

export const oddsSyncRuns = pgTable(
  "odds_sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull(),
    targetMatchId: uuid("target_match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    force: boolean("force").notNull().default(false),
    status: oddsSyncStatus("status").notNull(),
    summary: text("summary").notNull().default(""),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("odds_sync_runs_started_idx").on(t.startedAt),
    index("odds_sync_runs_target_match_idx").on(t.targetMatchId),
  ]
);

export const matchOddsSnapshots = pgTable(
  "match_odds_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => oddsSyncRuns.id, { onDelete: "cascade" }),
    market: oddsSnapshotMarket("market").notNull(),
    sourceUrl: text("source_url").notNull(),
    rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
    normalizedPayload: jsonb("normalized_payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("match_odds_snapshots_match_idx").on(t.matchId),
    index("match_odds_snapshots_run_idx").on(t.runId),
  ]
);

// One row per (user, match) — a single predicted score that creates two
// implicit bets: one on direction (HOME/DRAW/AWAY) and one on the exact
// score. The user's total stake is split 50/50 between them.
export const matchBets = pgTable(
  "match_bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    predictedHomeScore: integer("predicted_home_score").notNull(),
    predictedAwayScore: integer("predicted_away_score").notNull(),
    totalStake: integer("total_stake").notNull(),
    directionStake: integer("direction_stake").notNull(),
    scoreStake: integer("score_stake").notNull(),
    directionOddsLocked: numeric("direction_odds_locked", {
      precision: 5,
      scale: 2,
    }).notNull(),
    scoreOddsLocked: numeric("score_odds_locked", {
      precision: 6,
      scale: 2,
    }).notNull(),
    status: matchBetStatus("status").notNull().default("open"),
    directionOutcome: outcome("direction_outcome").notNull().default("pending"),
    scoreOutcome: outcome("score_outcome").notNull().default("pending"),
    payout: integer("payout"), // total chips credited at settle
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("match_bets_one_per_user_per_match").on(
      t.roomId,
      t.userId,
      t.matchId
    ),
    index("match_bets_room_idx").on(t.roomId),
    index("match_bets_match_idx").on(t.matchId),
  ]
);

// Options shape stored in jsonb:
//   [{ label: "Yes", probability: 0.42, odds: 2.38 }, ...]
export type CustomBetOption = {
  label: string;
  probability: number;
  odds: number;
};

export const customBets = pgTable(
  "custom_bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    proposerId: uuid("proposer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    kind: customBetKind("kind").notNull().default("fixed_options"),
    options: jsonb("options").$type<CustomBetOption[]>().notNull(),
    aiReasoning: text("ai_reasoning").notNull().default(""),
    status: customBetStatus("status").notNull().default("open"),
    winningOptionIdx: integer("winning_option_idx"),
    locksAt: timestamp("locks_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("custom_bets_room_idx").on(t.roomId),
    index("custom_bets_match_idx").on(t.matchId),
    index("custom_bets_status_idx").on(t.status),
  ]
);

export const customWagers = pgTable(
  "custom_wagers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customBetId: uuid("custom_bet_id")
      .notNull()
      .references(() => customBets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionIdx: integer("option_idx").notNull(),
    stake: integer("stake").notNull(),
    oddsLocked: numeric("odds_locked", { precision: 5, scale: 2 }).notNull(),
    status: wagerStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("custom_wagers_bet_idx").on(t.customBetId),
    index("custom_wagers_user_idx").on(t.userId),
  ]
);

// Audit log so settlements can be reviewed by any room member.
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: settlementKind("kind").notNull(),
    targetId: uuid("target_id").notNull(), // match.id or custom_bet.id
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("settlements_room_idx").on(t.roomId)]
);

// Append-only audit log of every chip movement. Lets each user see exactly
// where their balance came from / went to. Written by `recordLedger` after any
// successful chip mutation (initial grant, daily grant, bet placed, payout,
// refund). Includes a balance_after snapshot for easy display.
export const chipLedger = pgTable(
  "chip_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // negative for spend, positive for credit
    balanceAfter: integer("balance_after").notNull(),
    reason: ledgerReason("reason").notNull(),
    refMatchId: uuid("ref_match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    refCustomBetId: uuid("ref_custom_bet_id").references(() => customBets.id, {
      onDelete: "set null",
    }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chip_ledger_user_idx").on(t.userId),
    index("chip_ledger_room_idx").on(t.roomId),
    index("chip_ledger_created_idx").on(t.createdAt),
  ]
);

export type Room = typeof rooms.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthUser = typeof authUsers.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchBet = typeof matchBets.$inferSelect;
export type CustomBet = typeof customBets.$inferSelect;
export type CustomWager = typeof customWagers.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type ChipLedger = typeof chipLedger.$inferSelect;
export type OddsSyncRun = typeof oddsSyncRuns.$inferSelect;
export type MatchOddsSnapshot = typeof matchOddsSnapshots.$inferSelect;

export function scoreKey(home: number, away: number): string {
  return `${home}-${away}`;
}

export function parseScoreKey(key: string) {
  const match = /^(\d+)-(\d+)$/.exec(key.trim());
  if (!match) return null;
  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

export const SCORE_RANGE = 10; // 0..9 inclusive on each side (100 cells)
