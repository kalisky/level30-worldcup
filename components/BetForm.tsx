"use client";

import { useState, useTransition } from "react";
import { placeMatchBet } from "@/lib/actions/bets";
import { scoreKey, SCORE_RANGE, type ScoreOddsCache } from "@/lib/db/schema";

export default function BetForm({
  roomCode,
  matchId,
  homeTeam,
  awayTeam,
  oddsHome,
  oddsDraw,
  oddsAway,
  scoreOdds,
  maxStake,
}: {
  roomCode: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  scoreOdds: ScoreOddsCache;
  maxStake: number;
}) {
  const [home, setHome] = useState<number | null>(null);
  const [away, setAway] = useState<number | null>(null);
  const [stake, setStake] = useState<number>(50);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const directionPick: "HOME" | "DRAW" | "AWAY" | null =
    home === null || away === null
      ? null
      : home > away
        ? "HOME"
        : away > home
          ? "AWAY"
          : "DRAW";
  const directionOdds =
    directionPick === "HOME" ? oddsHome :
    directionPick === "DRAW" ? oddsDraw :
    directionPick === "AWAY" ? oddsAway : 0;
  const scoreOdd =
    home !== null && away !== null ? (scoreOdds[scoreKey(home, away)] ?? 0) : 0;

  const directionStake = Math.floor(stake / 2);
  const scoreStake = stake - directionStake;
  const directionPayout = Math.floor(directionStake * directionOdds);
  const scorePayout = Math.floor(scoreStake * scoreOdd);
  const bestCase = directionPayout + scorePayout;

  const canSubmit =
    home !== null &&
    away !== null &&
    stake >= 2 &&
    stake <= maxStake &&
    directionOdds > 0 &&
    scoreOdd > 0;

  async function submit() {
    if (home === null || away === null) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", matchId);
    fd.set("predictedHomeScore", String(home));
    fd.set("predictedAwayScore", String(away));
    fd.set("totalStake", String(stake));
    startTransition(async () => {
      try {
        await placeMatchBet(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to place bet.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Predict the score
      </h3>
      <p className="mb-3 text-xs text-zinc-500">
        Your stake is split 50/50: half on the direction (
        <span className="font-mono">{oddsHome.toFixed(2)}x / {oddsDraw.toFixed(2)}x / {oddsAway.toFixed(2)}x</span>
        ), half on the exact score.
      </p>

      <ScoreRow
        label={homeTeam}
        selected={home}
        onPick={setHome}
      />
      <ScoreRow
        label={awayTeam}
        selected={away}
        onPick={setAway}
      />

      {home !== null && away !== null && (
        <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
          <div className="flex items-center justify-between">
            <span>Your prediction:</span>
            <span className="font-mono font-semibold">
              {homeTeam} {home} – {away} {awayTeam}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-zinc-600 dark:text-zinc-300">
            <span>
              Direction:{" "}
              <span className="font-semibold">
                {directionPick === "HOME" ? homeTeam : directionPick === "AWAY" ? awayTeam : "Draw"}
              </span>{" "}
              @ <span className="font-mono">{directionOdds.toFixed(2)}x</span>
            </span>
            <span className="text-zinc-500">
              Exact <span className="font-mono">{scoreOdd.toFixed(2)}x</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Total stake</label>
        <input
          type="number"
          min={2}
          max={maxStake}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-right font-mono dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span className="text-xs text-zinc-500">/ {maxStake} chips</span>
      </div>

      {home !== null && away !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
            <div className="text-zinc-500">If direction is right</div>
            <div className="font-mono text-base">{directionPayout} chips</div>
          </div>
          <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
            <div className="text-zinc-500">If exact score too</div>
            <div className="font-mono text-base">{bestCase} chips</div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit || pending}
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Placing…" : "Place bet"}
      </button>
    </div>
  );
}

function ScoreRow({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: number | null;
  onPick: (n: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: SCORE_RANGE }).map((_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={
              "h-9 w-9 rounded-lg border-2 font-mono text-sm transition " +
              (selected === n
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30"
                : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600")
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
