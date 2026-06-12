"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import TeamFlag from "@/components/TeamFlag";
import { useTeamName } from "@/hooks/useTeamName";
import {
  quickBetActiveParts,
  quickBetTotal,
  useQuickBet,
  type QuickBetDirection,
} from "@/hooks/useQuickBet";
import { parseScoreKey, scoreKey, type MatchBet, type ScoreOddsCache } from "@/lib/db/schema";

type DirectionGroup = QuickBetDirection;

type ExactScoreChoice = {
  key: string;
  home: number;
  away: number;
  odd: number;
};

const STAKE_PRESETS = [2, 5, 10, 25, 50];

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

export default function QuickBetForm({
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
  defaultDirectionStake,
  defaultScoreStake,
}: {
  roomCode: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  scoreOdds: ScoreOddsCache;
  /** Chips currently available (the existing bet's stake is re-spendable on top). */
  maxStake: number;
  existingBet: MatchBet | null;
  defaultDirectionStake: number | null;
  defaultScoreStake: number | null;
}) {
  const tb = useTranslations("bet");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);

  // Chips in hand plus the already-staked amount a change would re-spend.
  // The server re-validates on every save regardless.
  const budget = maxStake + (existingBet?.totalStake ?? 0);

  const { desired, apply, status, error } = useQuickBet({
    roomCode,
    matchId,
    existing: existingBet,
    defaultDirectionStake,
    defaultScoreStake,
    budget,
    overBudgetMessage: tb("notEnoughChips", { max: budget }),
  });

  const exactScoreChoices = Object.entries(scoreOdds)
    .flatMap(([key, odd]) => {
      const parsed = parseScoreKey(key);
      if (!parsed) return [];
      const numericOdd = Number(odd);
      if (!Number.isFinite(numericOdd) || numericOdd <= 1) return [];
      return [
        { key, home: parsed.home, away: parsed.away, odd: numericOdd } satisfies ExactScoreChoice,
      ];
    })
    .sort(compareChoices);
  const hasExactScoreChoices = exactScoreChoices.length > 0;
  const availableScoreKeys = new Set(exactScoreChoices.map((choice) => choice.key));
  const availableHomeScores = uniqueSortedNumbers(
    exactScoreChoices
      .filter((choice) => desired.away === null || choice.away === desired.away)
      .map((choice) => choice.home)
  );
  const availableAwayScores = uniqueSortedNumbers(
    exactScoreChoices
      .filter((choice) => desired.home === null || choice.home === desired.home)
      .map((choice) => choice.away)
  );

  function togglePick(pick: DirectionGroup) {
    apply({ pick: desired.pick === pick ? null : pick }, 150);
  }

  function updateHomeScore(nextHome: number | null) {
    if (
      nextHome !== null &&
      desired.away !== null &&
      !availableScoreKeys.has(scoreKey(nextHome, desired.away))
    ) {
      apply({ home: nextHome, away: null });
      return;
    }
    apply({ home: nextHome });
  }

  function updateAwayScore(nextAway: number | null) {
    if (
      nextAway !== null &&
      desired.home !== null &&
      !availableScoreKeys.has(scoreKey(desired.home, nextAway))
    ) {
      apply({ away: nextAway, home: null });
      return;
    }
    apply({ away: nextAway });
  }

  const { hasDirection, hasScore } = quickBetActiveParts(desired);
  const directionOdds =
    desired.pick === "HOME"
      ? oddsHome
      : desired.pick === "DRAW"
        ? oddsDraw
        : desired.pick === "AWAY"
          ? oddsAway
          : 0;
  const selectedKey =
    desired.home !== null && desired.away !== null
      ? scoreKey(desired.home, desired.away)
      : null;
  const scoreOdd = selectedKey ? Number(scoreOdds[selectedKey] ?? 0) : 0;
  const directionPayout = Math.floor(desired.sideStake * directionOdds);
  const scorePayout = Math.floor(desired.scoreStake * scoreOdd);
  const totalStake = quickBetTotal(desired);

  const scoreImpliesDirection = impliedDirection(desired.home, desired.away);
  const mismatched =
    hasDirection &&
    hasScore &&
    scoreImpliesDirection !== null &&
    desired.pick !== scoreImpliesDirection;

  return (
    <div className="space-y-4">
      {/* Pick a side — saves instantly */}
      <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tb("step1Side")}
          </h3>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {tb("instantHint")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SideButton
            label={localizedHome}
            teamName={homeTeam}
            odds={oddsHome}
            selected={desired.pick === "HOME"}
            onSelect={() => togglePick("HOME")}
          />
          <SideButton
            label={tm("draw")}
            odds={oddsDraw}
            selected={desired.pick === "DRAW"}
            onSelect={() => togglePick("DRAW")}
          />
          <SideButton
            label={localizedAway}
            teamName={awayTeam}
            odds={oddsAway}
            selected={desired.pick === "AWAY"}
            onSelect={() => togglePick("AWAY")}
          />
        </div>

        {desired.pick !== null && (
          <StakeRow
            label={tb("sideStake")}
            stake={desired.sideStake}
            payout={directionPayout}
            payoutLabel={tb("payIfWin", { amount: directionPayout })}
            maxStake={budget}
            onChange={(stake) => apply({ sideStake: stake })}
          />
        )}
      </section>

      {/* Pick the exact score — saves instantly */}
      <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {tb("step2Score")}
          </h3>
          <div className="flex items-center gap-2">
            {(desired.home !== null || desired.away !== null) && (
              <button
                type="button"
                onClick={() => apply({ home: null, away: null }, 150)}
                className="rounded-full border border-[#cdd9ea] bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:border-[#3B82F6] hover:text-[#1D4ED8]"
              >
                {tb("clearScore")}
              </button>
            )}
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {tb("step2Hint")}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <ScoreSelectField
            title={localizedHome}
            teamName={homeTeam}
            selectedScore={desired.home}
            scores={availableHomeScores}
            placeholder={tb("selectScore")}
            onPick={updateHomeScore}
          />
          <ScoreSelectField
            title={localizedAway}
            teamName={awayTeam}
            selectedScore={desired.away}
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

        {hasScore && (
          <StakeRow
            label={tb("scoreStakeLabel")}
            stake={desired.scoreStake}
            payout={scorePayout}
            payoutLabel={tb("payIfExact", { amount: scorePayout })}
            maxStake={budget}
            onChange={(stake) => apply({ scoreStake: stake })}
          />
        )}
      </section>

      {/* Mismatch warning (informational only) */}
      {mismatched && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tb("mismatchWarning", {
            side:
              desired.pick === "HOME"
                ? localizedHome
                : desired.pick === "AWAY"
                  ? localizedAway
                  : tm("draw"),
            scoreSide:
              scoreImpliesDirection === "HOME"
                ? localizedHome
                : scoreImpliesDirection === "AWAY"
                  ? localizedAway
                  : tm("draw"),
            home: desired.home ?? 0,
            away: desired.away ?? 0,
          })}
        </div>
      )}

      {/* Status strip */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#dbe5f2] bg-white px-4 py-3 text-sm shadow-[0_10px_24px_rgba(30,58,138,0.06)]">
        <span className="font-semibold text-slate-600">
          {tb("totalStake")}:{" "}
          <span className="font-mono font-black text-[#1E3A8A]">
            {totalStake} {tc("chips")}
          </span>
        </span>
        <span
          className={
            "text-xs font-bold uppercase tracking-[0.16em] " +
            (status === "error"
              ? "text-red-600"
              : status === "saving"
                ? "text-slate-400"
                : status === "saved"
                  ? "text-emerald-600"
                  : "text-slate-300")
          }
        >
          {status === "saving"
            ? tb("saving")
            : status === "saved"
              ? tb("saved")
              : status === "error"
                ? tb("saveFailed")
                : tb("instantHint")}
        </span>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Shows the staked amount and projected payout; the amount itself is only
 * editable behind the gear toggle so betting never requires touching it.
 */
export function StakeRow({
  label,
  stake,
  payout,
  payoutLabel,
  maxStake,
  onChange,
}: {
  label: string;
  stake: number;
  payout: number;
  payoutLabel: string;
  maxStake: number;
  onChange: (stake: number) => void;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  function clamp(value: number) {
    return Math.max(2, Math.min(maxStake, Math.floor(value) || 2));
  }

  return (
    <div className="mt-4 rounded-[22px] border border-[#e7eef8] bg-[#F8FBFF] px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-600">{label}:</span>
        <span className="font-mono font-black text-[#1E3A8A]">
          {stake} {tc("chips")}
        </span>
        {payout > 0 && (
          <span className="text-xs text-slate-500">{payoutLabel}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`${label} — edit`}
          aria-expanded={open}
          className={
            "-my-2 ms-auto flex h-11 w-11 items-center justify-center rounded-full border text-3xl transition " +
            (open
              ? "border-[#3B82F6] bg-[#E0EEFF] text-[#1D4ED8]"
              : "border-[#cdd9ea] bg-white text-slate-500 hover:border-[#3B82F6] hover:text-[#1D4ED8]")
          }
        >
          ⚙
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STAKE_PRESETS.filter((p) => p <= maxStake).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={
                "rounded-full border px-3 py-1.5 font-mono text-sm font-bold transition " +
                (preset === stake
                  ? "border-[#3B82F6] bg-[#E0EEFF] text-[#1D4ED8]"
                  : "border-[#cdd9ea] bg-white text-slate-600 hover:border-[#3B82F6]")
              }
            >
              {preset}
            </button>
          ))}
          <input
            type="number"
            min={2}
            max={maxStake}
            value={stake}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-20 rounded-2xl border border-[#cdd9ea] bg-white px-3 py-1.5 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:outline-none"
          />
        </div>
      )}
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
