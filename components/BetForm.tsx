"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import TeamFlag from "@/components/TeamFlag";
import { useTeamName } from "@/hooks/useTeamName";
import { placeMatchBet, updateMatchBet } from "@/lib/actions/bets";
import { parseScoreKey, scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

export type BetFormExisting = {
  predictedHomeScore: number;
  predictedAwayScore: number;
  totalStake: number;
};

type DirectionGroup = "HOME" | "DRAW" | "AWAY";

type ExactScoreChoice = {
  key: string;
  home: number;
  away: number;
  odd: number;
};

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, index) => index);

function compareChoices(a: ExactScoreChoice, b: ExactScoreChoice) {
  if (a.odd !== b.odd) return a.odd - b.odd;
  if (a.home !== b.home) return a.home - b.home;
  return a.away - b.away;
}

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
  existingBet,
  onCancel,
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
  existingBet?: BetFormExisting;
  onCancel?: () => void;
}) {
  const tb = useTranslations("bet");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
  const isEdit = !!existingBet;
  const existingKey = existingBet
    ? scoreKey(existingBet.predictedHomeScore, existingBet.predictedAwayScore)
    : null;
  const existingScoreStillAvailable = existingKey
    ? scoreOdds[existingKey] != null
    : false;
  const [home, setHome] = useState<number | null>(
    existingBet && existingScoreStillAvailable ? existingBet.predictedHomeScore : null
  );
  const [away, setAway] = useState<number | null>(
    existingBet && existingScoreStillAvailable ? existingBet.predictedAwayScore : null
  );
  const [stake, setStake] = useState<number>(existingBet?.totalStake ?? 50);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const exactScoreChoices = Object.entries(scoreOdds)
    .flatMap(([key, odd]) => {
      const parsed = parseScoreKey(key);
      if (!parsed) return [];
      const numericOdd = Number(odd);
      if (!Number.isFinite(numericOdd) || numericOdd <= 1) return [];
      return [
        {
          key,
          home: parsed.home,
          away: parsed.away,
          odd: numericOdd,
        } satisfies ExactScoreChoice,
      ];
    })
    .sort(compareChoices);
  const hasExactScoreChoices = exactScoreChoices.length > 0;
  const availableScoreKeys = new Set(exactScoreChoices.map((choice) => choice.key));

  const selectedKey = home !== null && away !== null ? scoreKey(home, away) : null;
  const directionPick: DirectionGroup | null =
    home === null || away === null
      ? null
      : home > away
        ? "HOME"
        : away > home
          ? "AWAY"
          : "DRAW";
  const directionOdds =
    directionPick === "HOME"
      ? oddsHome
      : directionPick === "DRAW"
        ? oddsDraw
        : directionPick === "AWAY"
          ? oddsAway
          : 0;
  const scoreOdd = selectedKey ? Number(scoreOdds[selectedKey] ?? 0) : 0;

  const directionStake = Math.floor(stake / 2);
  const scoreStake = stake - directionStake;
  const directionPayout = Math.floor(directionStake * directionOdds);
  const scorePayout = Math.floor(scoreStake * scoreOdd);
  const bestCase = directionPayout + scorePayout;
  const hasCompleteScore = home !== null && away !== null;
  const canSubmit =
    hasCompleteScore &&
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
        if (isEdit) {
          await updateMatchBet(fd);
          onCancel?.();
        } else {
          await placeMatchBet(fd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to place bet.");
      }
    });
  }

  function pickHomeScore(nextHome: number) {
    setHome(nextHome);
  }

  function pickAwayScore(nextAway: number) {
    setAway(nextAway);
  }

  return (
    <div className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <h3 className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
        {tb("predictScore")}
      </h3>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        {tb("splitHint")}
      </p>

      <div className="space-y-3">
        <ScorePadRow
          title={localizedHome}
          teamName={homeTeam}
          selectedScore={home}
          scores={SCORE_OPTIONS}
          isEnabled={(score) =>
            hasExactScoreChoices &&
            (away === null || availableScoreKeys.has(scoreKey(score, away)))
          }
          onPick={pickHomeScore}
        />
        <ScorePadRow
          title={localizedAway}
          teamName={awayTeam}
          selectedScore={away}
          scores={SCORE_OPTIONS}
          isEnabled={(score) =>
            hasExactScoreChoices &&
            (home === null || availableScoreKeys.has(scoreKey(home, score)))
          }
          onPick={pickAwayScore}
        />
      </div>

      {!hasExactScoreChoices && (
        <p className="mt-4 rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-500">
          {tb("noScoresAvailable")}
        </p>
      )}

      {hasCompleteScore && (
        <div className="mt-4 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">{tm("yourBet")}</span>
            <span className="font-mono text-base font-black text-[#1E3A8A]">
              {localizedHome} {home} – {away} {localizedAway}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-slate-600">
            <span>
              {tb("direction")}:{" "}
              <span className="font-bold text-[#1E3A8A]">
                {directionPick === "HOME"
                  ? localizedHome
                  : directionPick === "AWAY"
                    ? localizedAway
                    : tm("draw")}
              </span>{" "}
              @ <span className="font-mono">{directionOdds.toFixed(2)}x</span>
            </span>
            <span className="text-slate-500">
              {tb("exact")} <span className="font-mono">{scoreOdd.toFixed(2)}x</span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-600">{tb("totalStake")}</label>
        <input
          type="number"
          min={2}
          max={maxStake}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="w-24 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
        />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          / {maxStake} {tc("chips")}
        </span>
      </div>

      {hasCompleteScore && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-3">
            <div className="font-semibold uppercase tracking-[0.18em] text-slate-500">
              {tb("ifDirectionRight")}
            </div>
            <div className="mt-1 font-mono text-base font-black text-[#1E3A8A]">
              {directionPayout} {tc("chips")}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-3">
            <div className="font-semibold uppercase tracking-[0.18em] text-slate-500">
              {tb("ifExactScoreToo")}
            </div>
            <div className="mt-1 font-mono text-base font-black text-[#1E3A8A]">
              {bestCase} {tc("chips")}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-[24px] border border-[#cdd9ea] bg-white px-4 py-3 font-bold text-slate-600 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tc("cancel")}
          </button>
        )}
        <button
          type="button"
          disabled={!canSubmit || pending}
          onClick={submit}
          className="flex-1 rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_14px_30px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? isEdit
              ? tb("updatePending")
              : tb("placePending")
            : isEdit
              ? tb("update")
              : tb("place")}
        </button>
      </div>
    </div>
  );
}

function ScorePadRow({
  title,
  teamName,
  scores,
  selectedScore,
  isEnabled,
  onPick,
}: {
  title: string;
  teamName: string;
  scores: number[];
  selectedScore: number | null;
  isEnabled: (score: number) => boolean;
  onPick: (score: number) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <TeamFlag teamName={teamName} size={24} />
          <span>{title}</span>
        </div>
        <span className="rounded-full border border-[#dbe5f2] bg-white px-3 py-1 font-mono text-sm font-black text-[#1E3A8A]">
          {selectedScore ?? "–"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {scores.map((score) => {
          const enabled = isEnabled(score);
          const isSelected = selectedScore === score;
          return (
            <button
              key={score}
              type="button"
              disabled={!enabled}
              onClick={() => onPick(score)}
              className={
                "rounded-[18px] border px-0 py-3 text-center font-mono text-base font-black transition " +
                (isSelected
                  ? "border-[#3B82F6] bg-[#E0EEFF] text-[#1D4ED8]"
                  : enabled
                    ? "border-[#dbe5f2] bg-white text-slate-700 hover:border-[#3B82F6] hover:bg-white"
                    : "cursor-not-allowed border-[#e7eef8] bg-[#F8FBFF] text-slate-300")
              }
            >
              {score}
            </button>
          );
        })}
      </div>
    </section>
  );
}
