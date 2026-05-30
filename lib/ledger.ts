import { db } from "@/lib/db";
import { chipLedger } from "@/lib/db/schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type LedgerReason =
  | "opening_balance"
  | "initial"
  | "daily_grant"
  | "match_bet_placed"
  | "match_bet_payout"
  | "custom_wager_placed"
  | "custom_wager_payout"
  | "custom_wager_refund";

/**
 * Inserts one row into `chip_ledger`. Call this inside the same transaction
 * as the chip mutation it describes, after fetching the post-update balance
 * via `.returning({ chips: users.chips })`.
 */
export async function recordLedger(
  tx: Db | Tx,
  args: {
    roomId: string;
    userId: string;
    delta: number;
    balanceAfter: number;
    reason: LedgerReason;
    refMatchId?: string | null;
    refCustomBetId?: string | null;
    note?: string;
  }
) {
  await tx.insert(chipLedger).values({
    roomId: args.roomId,
    userId: args.userId,
    delta: args.delta,
    balanceAfter: args.balanceAfter,
    reason: args.reason,
    refMatchId: args.refMatchId ?? null,
    refCustomBetId: args.refCustomBetId ?? null,
    note: args.note ?? "",
  });
}
