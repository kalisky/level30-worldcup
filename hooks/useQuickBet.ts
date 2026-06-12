"use client";

import { useEffect, useRef, useState } from "react";
import { quickSetMatchBet } from "@/lib/actions/bets";

export type QuickBetDirection = "HOME" | "DRAW" | "AWAY";

export type QuickBetState = {
  pick: QuickBetDirection | null;
  sideStake: number;
  home: number | null;
  away: number | null;
  scoreStake: number;
};

export type QuickBetStatus = "idle" | "saving" | "saved" | "error";

const COMMIT_DEBOUNCE_MS = 600;

export function quickBetActiveParts(state: QuickBetState) {
  const hasDirection = state.pick !== null && state.sideStake > 0;
  const hasScore =
    state.home !== null && state.away !== null && state.scoreStake > 0;
  return { hasDirection, hasScore };
}

export function quickBetTotal(state: QuickBetState) {
  const { hasDirection, hasScore } = quickBetActiveParts(state);
  return (hasDirection ? state.sideStake : 0) + (hasScore ? state.scoreStake : 0);
}

/**
 * Instant-commit bet state: every `apply()` updates the UI immediately and
 * debounce-saves the complete desired state through `quickSetMatchBet`.
 * Overlapping saves queue so the latest state always wins, and a save error
 * surfaces without blocking further edits.
 */
export function useQuickBet({
  roomCode,
  matchId,
  initial,
  hasServerBet,
  budget,
  overBudgetMessage,
}: {
  roomCode: string;
  matchId: string;
  initial: QuickBetState;
  /** Whether a bet row already exists on the server for this match. */
  hasServerBet: boolean;
  /** Max total stake: chips in hand + the existing bet's re-spendable stake. */
  budget: number;
  overBudgetMessage: string;
}) {
  const [desired, setDesired] = useState<QuickBetState>(initial);
  const [status, setStatus] = useState<QuickBetStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs drive the commit pipeline so a debounced flush always sends the
  // latest state, and overlapping saves queue instead of racing.
  const desiredRef = useRef(desired);
  const committedEmptyRef = useRef(!hasServerBet);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function flush() {
    if (inflightRef.current) {
      queuedRef.current = true;
      return;
    }
    const state = desiredRef.current;
    const { hasDirection, hasScore } = quickBetActiveParts(state);

    // Nothing active and nothing on the server → no call needed.
    if (!hasDirection && !hasScore && committedEmptyRef.current) {
      setStatus("idle");
      return;
    }

    const total = quickBetTotal(state);
    if ((hasDirection || hasScore) && total > budget) {
      setStatus("error");
      setError(overBudgetMessage);
      return;
    }

    inflightRef.current = true;
    setStatus("saving");
    setError(null);

    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", matchId);
    fd.set("directionPick", hasDirection ? state.pick! : "");
    fd.set("directionStake", String(hasDirection ? state.sideStake : 0));
    fd.set("predictedHomeScore", hasScore ? String(state.home) : "");
    fd.set("predictedAwayScore", hasScore ? String(state.away) : "");
    fd.set("scoreStake", String(hasScore ? state.scoreStake : 0));

    quickSetMatchBet(fd)
      .then(() => {
        committedEmptyRef.current = !hasDirection && !hasScore;
        setStatus("saved");
      })
      .catch((e) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed to save bet.");
      })
      .finally(() => {
        inflightRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          flush();
        }
      });
  }

  function apply(patch: Partial<QuickBetState>, delayMs = COMMIT_DEBOUNCE_MS) {
    const next = { ...desiredRef.current, ...patch };
    desiredRef.current = next;
    setDesired(next);
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  }

  return { desired, apply, status, error };
}
