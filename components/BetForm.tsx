"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import TeamFlag from "@/components/TeamFlag";
import { useTeamName } from "@/hooks/useTeamName";
import { placeMatchBet, updateMatchBet } from "@/lib/actions/bets";
import { parseScoreKey, scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

export type BetFormExisting = {
  directionPick: "HOME" | "DRAW" | "AWAY";
  directionStake: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  scoreStake: number;
};

type DirectionGroup = "HOME" | "DRAW" | "AWAY";

type ExactScoreChoice = {
  key: string;
  home: number;
  away: number;
  odd: number;
};

function compareChoices(a: ExactScoreChoice, b: ExactScoreChoice) {
  if (a.odd !== b.odd) return a.odd - b.odd;
  if (a.home !== b.home) return a.home - b.home;
  return a.away - b.away;
}

function impliedDirection(
  home: number | null,
  away: number | null
): DirectionGroup | null {
  if (home === null || away === null) return null;
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

function uniqueSortedNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
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
  /** Chips the user has available to stake in this match. For edit mode the
   *  caller should add back the existing bet's totalStake so the user can
   *  re-spend it. */
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

  const [directionPick, setDirectionPick] = useState<DirectionGroup | null>(
    existingBet?.directionPick ?? null
  );
  const [directionStake, setDirectionStake] = useState<number>(
    existingBet?.directionStake ?? 10
  );
  const [home, setHome] = useState<number | null>(
    existingBet && existingScoreStillAvailable ? existingBet.predictedHomeScore : null
  );
  const [away, setAway] = useState<number | null>(
    existingBet && existingScoreStillAvailable ? existingBet.predictedAwayScore : null
  );
  const [scoreStake, setScoreStake] = useState<number>(
    existingBet?.scoreStake ?? 10
  );
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
  const availableHomeScores = uniqueSortedNumbers(
    exactScoreChoices
      .filter((choice) => away === null || choice.away === away)
      .map((choice) => choice.home)
  );
  const availableAwayScores = uniqueSortedNumbers(
    exactScoreChoices
      .filter((choice) => home === null || choice.home === home)
      .map((choice) => choice.away)
  );

  const selectedKey = home !== null && away !== null ? scoreKey(home, away) : null;
  const directionOdds =
    directionPick === "HOME"
      ? oddsHome
      : directionPick === "DRAW"
        ? oddsDraw
        : directionPick === "AWAY"
          ? oddsAway
          : 0;
  const scoreOdd = selectedKey ? Number(scoreOdds[selectedKey] ?? 0) : 0;

  const scoreImpliesDirection = impliedDirection(home, away);
  const sideStakeNum = Math.max(0, Math.floor(directionStake) || 0);
  const scoreStakeNum = Math.max(0, Math.floor(scoreStake) || 0);
  const totalStake = sideStakeNum + scoreStakeNum;
  const directionPayout = Math.floor(sideStakeNum * directionOdds);
  const scorePayout = Math.floor(scoreStakeNum * scoreOdd);
  const bestCase = directionPayout + scorePayout;
  const hasCompleteScore = home !== null && away !== null;
  const mismatched =
    directionPick !== null &&
    scoreImpliesDirection !== null &&
    directionPick !== scoreImpliesDirection &&
    sideStakeNum > 0 &&
    scoreStakeNum > 0;

  const canSubmit =
    directionPick !== null &&
    hasCompleteScore &&
    totalStake >= 2 &&
    totalStake <= maxStake &&
    directionOdds > 0 &&
    scoreOdd > 0;

  async function submit() {
    if (directionPick === null || home === null || away === null) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", matchId);
    fd.set("directionPick", directionPick);
    fd.set("directionStake", String(sideStakeNum));
    fd.set("predictedHomeScore", String(home));
    fd.set("predictedAwayScore", String(away));
    fd.set("scoreStake", String(scoreStakeNum));
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

  function updateHomeScore(nextHome: number | null) {
    if (nextHome === null) {
      setHome(null);
      return;
    }

    if (away !== null && !availableScoreKeys.has(scoreKey(nextHome, away))) {
      setAway(null);
    }
    setHome(nextHome);
  }

  function updateAwayScore(nextAway: number | null) {
    if (nextAway === null) {
      setAway(null);
      return;
    }

    if (home !== null && !availableScoreKeys.has(scoreKey(home, nextAway))) {
      setHome(null);
    }
    setAway(nextAway);
  }

  return (
    <div className="space-y-4">
      {/* Step 1 — pick a side and stake it */}
      <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tb("step1Side")}
          </h3>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tb("step1Hint")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SideButton
            label={localizedHome}
            teamName={homeTeam}
            odds={oddsHome}
            selected={directionPick === "HOME"}
            onSelect={() => setDirectionPick("HOME")}
          />
          <SideButton
            label={tm("draw")}
            odds={oddsDraw}
            selected={directionPick === "DRAW"}
            onSelect={() => setDirectionPick("DRAW")}
          />
          <SideButton
            label={localizedAway}
            teamName={awayTeam}
            odds={oddsAway}
            selected={directionPick === "AWAY"}
            onSelect={() => setDirectionPick("AWAY")}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">
            {tb("sideStake")}
          </label>
          <input
            type="number"
            min={0}
            max={maxStake}
            value={directionStake}
            onChange={(e) => setDirectionStake(Number(e.target.value))}
            className="w-24 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <span className="text-xs font-semibold text-slate-500">
            {tc("chips")}
          </span>
          {directionPick !== null && sideStakeNum > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {tb("payIfWin", { amount: directionPayout })}
            </span>
          )}
        </div>
      </section>

      {/* Step 2 — pick a score and stake it */}
      <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tb("step2Score")}
          </h3>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tb("step2Hint")}
          </span>
        </div>

        <div className="space-y-3">
          <ScoreSelectField
            title={localizedHome}
            teamName={homeTeam}
            selectedScore={home}
            scores={availableHomeScores}
            placeholder={tb("selectScore")}
            onPick={updateHomeScore}
          />
          <ScoreSelectField
            title={localizedAway}
            teamName={awayTeam}
            selectedScore={away}
            scores={availableAwayScores}
            placeholder={tb("selectScore")}
            onPick={updateAwayScore}
          />
        </div>

        {!hasExactScoreChoices && (
          <p className="mt-4 rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-500">
            {tb("noScoresAvailable")}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">
            {tb("scoreStakeLabel")}
          </label>
          <input
            type="number"
            min={0}
            max={maxStake}
            value={scoreStake}
            onChange={(e) => setScoreStake(Number(e.target.value))}
            className="w-24 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <span className="text-xs font-semibold text-slate-500">
            {tc("chips")}
          </span>
          {hasCompleteScore && scoreStakeNum > 0 && scoreOdd > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {tb("payIfExact", { amount: scorePayout })}
            </span>
          )}
        </div>
      </section>

      {/* Mismatch warning (informational only) */}
      {mismatched && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tb("mismatchWarning", {
            side:
              directionPick === "HOME"
                ? localizedHome
                : directionPick === "AWAY"
                  ? localizedAway
                  : tm("draw"),
            scoreSide:
              scoreImpliesDirection === "HOME"
                ? localizedHome
                : scoreImpliesDirection === "AWAY"
                  ? localizedAway
                  : tm("draw"),
            home: home ?? 0,
            away: away ?? 0,
          })}
        </div>
      )}

      {/* Summary + submit */}
      <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-600">{tb("totalStake")}</span>
          <span className="font-mono text-base font-black text-[#1E3A8A]">
            {totalStake} {tc("chips")}
          </span>
        </div>
        {(sideStakeNum > 0 || scoreStakeNum > 0) && (
          <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-slate-500">
            <span>{tb("payIfBoth")}</span>
            <span className="font-mono font-bold text-[#1E3A8A]">
              {bestCase} {tc("chips")}
            </span>
          </div>
        )}
        {totalStake > maxStake && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {tb("notEnoughChips", { max: maxStake })}
          </p>
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
      </section>
    </div>
  );
}

function SideButton({
  label,
  teamName,
  odds,
  selected,
  onSelect,
}: {
  label: string;
  teamName?: string;
  odds: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 transition " +
        (selected
          ? "border-[#3B82F6] bg-[#E0EEFF]"
          : "border-[#dbe5f2] bg-white hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
      }
    >
      {teamName ? (
        <TeamFlag teamName={teamName} size={28} />
      ) : (
        <span className="text-xl" aria-hidden>
          ⚖️
        </span>
      )}
      <span className="text-xs font-bold text-[#1E3A8A]">{label}</span>
      <span className="font-mono text-sm font-black text-[#1D4ED8]">
        {odds.toFixed(2)}x
      </span>
    </button>
  );
}

function ScoreSelectField({
  title,
  teamName,
  scores,
  selectedScore,
  placeholder,
  onPick,
}: {
  title: string;
  teamName: string;
  scores: number[];
  selectedScore: number | null;
  placeholder: string;
  onPick: (score: number | null) => void;
}) {
  const selectedIndex =
    selectedScore === null ? -1 : scores.indexOf(selectedScore);
  const canDecrement = selectedIndex > 0;
  const canIncrement =
    scores.length > 0 &&
    (selectedIndex === -1 || selectedIndex < scores.length - 1);

  function decrement() {
    if (!canDecrement) return;
    onPick(scores[selectedIndex - 1] ?? null);
  }

  function increment() {
    if (!canIncrement) return;
    if (selectedIndex === -1) {
      onPick(scores[0] ?? null);
      return;
    }
    onPick(scores[selectedIndex + 1] ?? null);
  }

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
      <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={!canDecrement}
          aria-label={`Decrease ${title} score`}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-[#dbe5f2] bg-white font-mono text-2xl font-black text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-40"
        >
          -
        </button>
        <div className="flex min-h-[52px] items-center justify-center rounded-[18px] border border-[#dbe5f2] bg-white px-4 text-center">
          {selectedScore === null ? (
            <span className="text-sm font-semibold text-slate-400">
              {placeholder}
            </span>
          ) : (
            <span className="font-mono text-2xl font-black text-[#1E3A8A]">
              {selectedScore}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={increment}
          disabled={!canIncrement}
          aria-label={`Increase ${title} score`}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-[#dbe5f2] bg-white font-mono text-2xl font-black text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </section>
  );
}
