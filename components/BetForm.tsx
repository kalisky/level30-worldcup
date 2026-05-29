"use client";

import { useState, useTransition } from "react";
import TeamFlag from "@/components/TeamFlag";
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
    <div className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h3 className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        Predict the score
      </h3>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Your stake is split 50/50: half on the direction (
        <span className="font-mono font-bold text-[#1E3A8A]">
          {oddsHome.toFixed(2)}x / {oddsDraw.toFixed(2)}x /{" "}
          {oddsAway.toFixed(2)}x
        </span>
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
        <div className="mt-4 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">Your prediction</span>
            <span className="font-mono text-base font-black text-[#1E3A8A]">
              {homeTeam} {home} – {away} {awayTeam}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-slate-600">
            <span>
              Direction:{" "}
              <span className="font-bold text-[#1E3A8A]">
                {directionPick === "HOME" ? homeTeam : directionPick === "AWAY" ? awayTeam : "Draw"}
              </span>{" "}
              @ <span className="font-mono">{directionOdds.toFixed(2)}x</span>
            </span>
            <span className="text-slate-500">
              Exact <span className="font-mono">{scoreOdd.toFixed(2)}x</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-600">Total stake</label>
        <input
          type="number"
          min={2}
          max={maxStake}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="w-24 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
        />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          / {maxStake} chips
        </span>
      </div>

      {home !== null && away !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-3">
            <div className="font-semibold uppercase tracking-[0.18em] text-slate-500">
              If direction is right
            </div>
            <div className="mt-1 font-mono text-base font-black text-[#1E3A8A]">
              {directionPayout} chips
            </div>
          </div>
          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-3">
            <div className="font-semibold uppercase tracking-[0.18em] text-slate-500">
              If exact score too
            </div>
            <div className="mt-1 font-mono text-base font-black text-[#1E3A8A]">
              {bestCase} chips
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit || pending}
        onClick={submit}
        className="mt-4 w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_14px_30px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <TeamFlag teamName={label} size={28} />
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: SCORE_RANGE }).map((_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={
              "h-9 w-9 rounded-xl border-2 font-mono text-sm font-bold transition " +
              (selected === n
                ? "border-[#3B82F6] bg-[#E0EEFF] text-[#1D4ED8]"
                : "border-[#dbe5f2] bg-white text-slate-600 hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
