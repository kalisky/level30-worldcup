"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
const FALLBACK_STAKE = 10;

// Last stake the user actually saved this page-load, shared across every
// mounted bet card so "set 2 on one match, tap the next match" starts the
// next bet at 2 immediately — server-stored defaults only catch up on the
// next render pass.
type SessionStakeDefaults = { direction: number | null; score: number | null };
let sessionStakeDefaults: SessionStakeDefaults = { direction: null, score: null };
const sessionListeners = new Set<() => void>();

function publishSessionStakeDefaults(patch: Partial<SessionStakeDefaults>) {
  sessionStakeDefaults = { ...sessionStakeDefaults, ...patch };
  for (const listener of sessionListeners) listener();
}

function subscribeSessionStakeDefaults(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

const SERVER_SNAPSHOT: SessionStakeDefaults = { direction: null, score: null };

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

type InternalState = {
  pick: QuickBetDirection | null;
  home: number | null;
  away: number | null;
  // null = no explicit choice for this card; follow the freshest default
  // (this session's last save, falling back to the server-stored default).
  sideStakeOverride: number | null;
  scoreStakeOverride: number | null;
};

/**
 * Instant-commit bet state: every `apply()` updates the UI immediately and
 * debounce-saves the complete desired state through `quickSetMatchBet`.
 * Overlapping saves queue so the latest state always wins, and a save error
 * surfaces without blocking further edits.
 *
 * Stakes resolve as: explicit value for this card (existing bet or a gear
 * edit) → last stake saved anywhere this session → server-stored per-user
 * default → 10.
 */
export function useQuickBet({
  roomCode,
  matchId,
  existing,
  defaultDirectionStake,
  defaultScoreStake,
  budget,
  overBudgetMessage,
}: {
  roomCode: string;
  matchId: string;
  /** The user's committed bet on this match, if any. */
  existing: {
    directionPick: QuickBetDirection;
    directionStake: number;
    predictedHomeScore: number;
    predictedAwayScore: number;
    scoreStake: number;
  } | null;
  defaultDirectionStake: number | null;
  defaultScoreStake: number | null;
  /** Max total stake: chips in hand + the existing bet's re-spendable stake. */
  budget: number;
  overBudgetMessage: string;
}) {
  const existingHasDirection = !!existing && existing.directionStake > 0;
  const existingHasScore = !!existing && existing.scoreStake > 0;

  const [state, setState] = useState<InternalState>({
    pick: existingHasDirection ? existing!.directionPick : null,
    home: existingHasScore ? existing!.predictedHomeScore : null,
    away: existingHasScore ? existing!.predictedAwayScore : null,
    sideStakeOverride: existingHasDirection ? existing!.directionStake : null,
    scoreStakeOverride: existingHasScore ? existing!.scoreStake : null,
  });
  const [status, setStatus] = useState<QuickBetStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const session = useSyncExternalStore(
    subscribeSessionStakeDefaults,
    () => sessionStakeDefaults,
    () => SERVER_SNAPSHOT
  );

  // Refs drive the commit pipeline so a debounced flush always sends the
  // latest state, and overlapping saves queue instead of racing.
  const stateRef = useRef(state);
  const committedEmptyRef = useRef(!existing);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function resolveStakes(s: InternalState) {
    return {
      sideStake:
        s.sideStakeOverride ??
        sessionStakeDefaults.direction ??
        defaultDirectionStake ??
        FALLBACK_STAKE,
      scoreStake:
        s.scoreStakeOverride ??
        sessionStakeDefaults.score ??
        defaultScoreStake ??
        FALLBACK_STAKE,
    };
  }

  function toPublic(s: InternalState): QuickBetState {
    const { sideStake, scoreStake } = resolveStakes(s);
    return { pick: s.pick, home: s.home, away: s.away, sideStake, scoreStake };
  }

  function flush() {
    if (inflightRef.current) {
      queuedRef.current = true;
      return;
    }
    const current = toPublic(stateRef.current);
    const { hasDirection, hasScore } = quickBetActiveParts(current);

    // Nothing active and nothing on the server → no call needed.
    if (!hasDirection && !hasScore && committedEmptyRef.current) {
      setStatus("idle");
      return;
    }

    const total = quickBetTotal(current);
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
    fd.set("directionPick", hasDirection ? current.pick! : "");
    fd.set("directionStake", String(hasDirection ? current.sideStake : 0));
    fd.set("predictedHomeScore", hasScore ? String(current.home) : "");
    fd.set("predictedAwayScore", hasScore ? String(current.away) : "");
    fd.set("scoreStake", String(hasScore ? current.scoreStake : 0));

    quickSetMatchBet(fd)
      .then(() => {
        committedEmptyRef.current = !hasDirection && !hasScore;
        if (hasDirection) publishSessionStakeDefaults({ direction: current.sideStake });
        if (hasScore) publishSessionStakeDefaults({ score: current.scoreStake });
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
    const next: InternalState = { ...stateRef.current };
    if ("pick" in patch) next.pick = patch.pick ?? null;
    if ("home" in patch) next.home = patch.home ?? null;
    if ("away" in patch) next.away = patch.away ?? null;
    if (patch.sideStake !== undefined) next.sideStakeOverride = patch.sideStake;
    if (patch.scoreStake !== undefined) next.scoreStakeOverride = patch.scoreStake;
    stateRef.current = next;
    setState(next);
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  }

  // `session` is consumed so untouched cards re-render when another card
  // saves a new stake.
  void session;

  return { desired: toPublic(state), apply, status, error };
}
