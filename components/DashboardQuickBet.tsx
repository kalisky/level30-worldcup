"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import TeamFlag from "@/components/TeamFlag";
import { useTeamName } from "@/hooks/useTeamName";
import { placeMatchBet } from "@/lib/actions/bets";
import { parseScoreKey, scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

export type DashboardQuickBetExisting = {
  directionPick: "HOME" | "DRAW" | "AWAY";
  directionStake: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  scoreStake: number;
  totalStake: number;
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

function directionLabel(
  direction: DirectionGroup,
  homeLabel: string,
  awayLabel: string,
  drawLabel: string
) {
  if (direction === "HOME") return homeLabel;
  if (direction === "AWAY") return awayLabel;
  return drawLabel;
}

function pickDefaultScore(
  choices: ExactScoreChoice[],
  direction: DirectionGroup
) {
  return (
    choices.find((choice) => impliedDirection(choice.home, choice.away) === direction) ??
    choices[0] ??
    null
  );
}

function scoreSummary(
  home: number,
  away: number,
  stake: number,
  chipsLabel: string,
  odd: number
) {
  return odd > 0
    ? `${home}-${away} · ${stake} ${chipsLabel} · ${odd.toFixed(2)}x`
    : `${home}-${away} · ${stake} ${chipsLabel}`;
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
          <TeamFlag teamName={teamName} size={22} />
          <span>{title}</span>
        </div>
        {/* <span className="rounded-full border border-[#dbe5f2] bg-white px-3 py-1 font-mono text-sm font-black text-[#1E3A8A]">
          {selectedScore ?? "–"}
        </span> */}
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

function ExactScoreDialog({
  open,
  onClose,
  onSave,
  homeTeam,
  awayTeam,
  initialHome,
  initialAway,
  initialStake,
  sideStake,
  maxStake,
  choices,
  directionPick,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (value: { home: number; away: number; stake: number }) => void;
  homeTeam: string;
  awayTeam: string;
  initialHome: number | null;
  initialAway: number | null;
  initialStake: number;
  sideStake: number;
  maxStake: number;
  choices: ExactScoreChoice[];
  directionPick: DirectionGroup | null;
}) {
  const tb = useTranslations("bet");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
  const drawLabel = tm("draw");
  const [home, setHome] = useState<number | null>(initialHome);
  const [away, setAway] = useState<number | null>(initialAway);
  const [stake, setStake] = useState<number>(initialStake);

  const availableScoreKeys = new Set(choices.map((choice) => choice.key));
  const availableHomeScores = uniqueSortedNumbers(
    choices
      .filter((choice) => away === null || choice.away === away)
      .map((choice) => choice.home)
  );
  const availableAwayScores = uniqueSortedNumbers(
    choices
      .filter((choice) => home === null || choice.home === home)
      .map((choice) => choice.away)
  );

  const selectedKey = home !== null && away !== null ? scoreKey(home, away) : null;
  const selectedScoreOdd = choices.find((choice) => choice.key === selectedKey)?.odd ?? 0;
  const stakeNum = Math.max(0, Math.floor(stake) || 0);
  const totalStake = sideStake + stakeNum;
  const scoreImpliesDirection = impliedDirection(home, away);
  const mismatched =
    directionPick !== null &&
    scoreImpliesDirection !== null &&
    directionPick !== scoreImpliesDirection;
  const canSave =
    selectedKey !== null &&
    selectedScoreOdd > 0 &&
    totalStake <= maxStake;

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

  const portalTarget = typeof document === "undefined" ? null : document.body;

  if (!open || !portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="flex w-full max-w-lg flex-col rounded-[30px] border border-[#dbe5f2] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-[#1E3A8A]">
              {tb("predictScore")}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {localizedHome} {tm("vs")} {localizedAway}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#dbe5f2] px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            {tc("close")}
          </button>
        </div>

        <div className="mt-5 space-y-3">
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

          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-600">
                {tb("scoreStakeLabel")}
              </label>
              <input
                type="number"
                min={0}
                max={Math.max(0, maxStake - sideStake)}
                value={stake}
                onChange={(event) => setStake(Number(event.target.value))}
                className="w-24 rounded-2xl border border-[#cdd9ea] bg-white px-3 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:outline-none"
              />
              <span className="text-xs font-semibold text-slate-500">
                {tc("chips")}
              </span>
              {selectedKey !== null && selectedScoreOdd > 0 ? (
                <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-black text-[#1D4ED8]">
                    {selectedScoreOdd.toFixed(2)}x
                  </span>
                </span>
              ) : null}
            </div>
            {stakeNum > 0 ? (
              <span className="text-xs text-slate-500">
                {tb("payIfExact", {
                  amount: Math.floor(stakeNum * selectedScoreOdd),
                })}
              </span>
            ) : null}

            {totalStake > maxStake ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {tb("notEnoughChips", { max: maxStake })}
              </p>
            ) : null}
          </div>
        </div>

        {/* {mismatched && home !== null && away !== null && (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {tb("mismatchWarning", {
              side:
                directionPick === "HOME"
                  ? localizedHome
                  : directionPick === "AWAY"
                    ? localizedAway
                    : drawLabel,
              scoreSide:
                scoreImpliesDirection === "HOME"
                  ? localizedHome
                  : scoreImpliesDirection === "AWAY"
                    ? localizedAway
                    : drawLabel,
              home,
              away,
            })}
          </div>
        )} */}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[24px] border border-[#cdd9ea] bg-white px-4 py-3 font-bold text-slate-600 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (home === null || away === null) return;
              onSave({ home, away, stake: stakeNum });
            }}
            className="flex-1 rounded-[24px] bg-[#1E3A8A] px-4 py-3 font-bold text-white shadow-[0_14px_30px_rgba(30,58,138,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tc("save")}
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}

export default function DashboardQuickBet({
  roomCode,
  matchId,
  matchStatus,
  kickoff,
  homeTeam,
  awayTeam,
  oddsHome,
  oddsDraw,
  oddsAway,
  scoreOdds,
  maxStake,
  now,
  myBet,
}: {
  roomCode: string;
  matchId: string;
  matchStatus: "scheduled" | "live" | "final";
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  scoreOdds: ScoreOddsCache | null;
  maxStake: number;
  now: number;
  myBet?: DashboardQuickBetExisting | null;
}) {
  const tb = useTranslations("bet");
  const td = useTranslations("dashboard");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
  const drawLabel = tm("draw");
  const [directionPick, setDirectionPick] = useState<DirectionGroup | null>(null);
  const [directionStake, setDirectionStake] = useState<number>(
    Math.min(10, Math.max(0, maxStake))
  );
  const [home, setHome] = useState<number | null>(null);
  const [away, setAway] = useState<number | null>(null);
  const [scoreStake, setScoreStake] = useState<number>(0);
  const [scoreWasCustomized, setScoreWasCustomized] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLocked = matchStatus !== "scheduled" || new Date(kickoff).getTime() <= now;
  const hasDirectionOdds = oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds && Object.keys(scoreOdds).length > 0;
  const hasOdds = hasDirectionOdds && hasScoreOdds;

  const exactScoreChoices = Object.entries(scoreOdds ?? {})
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

  const selectedKey = home !== null && away !== null ? scoreKey(home, away) : null;
  const selectedScoreOdd =
    selectedKey != null
      ? exactScoreChoices.find((choice) => choice.key === selectedKey)?.odd ?? 0
      : 0;
  const directionOdds =
    directionPick === "HOME"
      ? oddsHome ?? 0
      : directionPick === "DRAW"
        ? oddsDraw ?? 0
        : directionPick === "AWAY"
          ? oddsAway ?? 0
          : 0;
  const sideStakeNum = Math.max(0, Math.floor(directionStake) || 0);
  const scoreStakeNum = Math.max(0, Math.floor(scoreStake) || 0);
  const totalStake = sideStakeNum + scoreStakeNum;
  const directionPayout = Math.floor(sideStakeNum * directionOdds);
  const scorePayout = Math.floor(scoreStakeNum * selectedScoreOdd);
  const bestCasePayout =
    scoreStakeNum > 0 && selectedScoreOdd > 0
      ? directionPayout + scorePayout
      : directionPayout;
  const directionSummary =
    directionPick != null
      ? directionLabel(directionPick, localizedHome, localizedAway, drawLabel)
      : null;
  const fallbackChoice =
    directionPick != null ? pickDefaultScore(exactScoreChoices, directionPick) : null;
  const scoreImpliesDirection = impliedDirection(home, away);
  const mismatched =
    directionPick !== null &&
    scoreImpliesDirection !== null &&
    directionPick !== scoreImpliesDirection &&
    sideStakeNum > 0 &&
    scoreStakeNum > 0;
  const canSubmit =
    directionPick !== null &&
    sideStakeNum >= 2 &&
    totalStake <= maxStake &&
    directionOdds > 0 &&
    (selectedKey !== null || fallbackChoice !== null);

  function applyDefaultScore(nextDirection: DirectionGroup) {
    const fallback = pickDefaultScore(exactScoreChoices, nextDirection);
    if (!fallback) return;
    setHome(fallback.home);
    setAway(fallback.away);
  }

  function handleSelectDirection(nextDirection: DirectionGroup) {
    setDirectionPick(nextDirection);
    setError(null);
    if (!scoreWasCustomized || home === null || away === null) {
      applyDefaultScore(nextDirection);
    }
  }

  function handleCancel() {
    setDirectionPick(null);
    setHome(null);
    setAway(null);
    setScoreStake(0);
    setScoreWasCustomized(false);
    setError(null);
    setDirectionStake(Math.min(10, Math.max(0, maxStake)));
  }

  function openScoreDialog() {
    if (directionPick === null) return;
    if (home === null || away === null) {
      applyDefaultScore(directionPick);
    }
    setScoreDialogOpen(true);
  }

  async function submit() {
    if (directionPick === null) return;

    // Match bets always store a scoreline, even when the dashboard flow is
    // placing a side-only bet with `scoreStake = 0`.
    const scoreChoice =
      selectedKey !== null
        ? { home: home!, away: away! }
        : fallbackChoice
          ? { home: fallbackChoice.home, away: fallbackChoice.away }
          : null;
    if (!scoreChoice) return;

    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", matchId);
    fd.set("directionPick", directionPick);
    fd.set("directionStake", String(sideStakeNum));
    fd.set("predictedHomeScore", String(scoreChoice.home));
    fd.set("predictedAwayScore", String(scoreChoice.away));
    fd.set("scoreStake", String(scoreStakeNum));

    startTransition(async () => {
      try {
        await placeMatchBet(fd);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Failed to place bet."
        );
      }
    });
  }

  if (myBet) {
    const sideLabel = directionLabel(
      myBet.directionPick,
      localizedHome,
      localizedAway,
      drawLabel
    );
    const hasScoreBet = myBet.scoreStake > 0;

    return (
      <div className="mt-4 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            {tm("yourBet")}
          </span>
          <span className="font-mono text-xs font-bold text-[#1D4ED8]">
            {myBet.totalStake} {tc("chips")}
          </span>
        </div>
        <p className="mt-2 text-sm font-bold text-[#1E3A8A]">
          {hasScoreBet
            ? `${localizedHome} ${myBet.predictedHomeScore}–${myBet.predictedAwayScore} ${localizedAway}`
            : sideLabel}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {tb("directionOutcome")}: {sideLabel} · {myBet.directionStake} {tc("chips")}
          {hasScoreBet
            ? ` · ${scoreSummary(
                myBet.predictedHomeScore,
                myBet.predictedAwayScore,
                myBet.scoreStake,
                tc("chips"),
                Number(
                  scoreOdds?.[
                    scoreKey(myBet.predictedHomeScore, myBet.predictedAwayScore)
                  ] ?? 0
                )
              )}`
            : ""}
        </p>
      </div>
    );
  }

  if (isLocked || !hasOdds) {
    return null;
  }

  return (
    <>
      <div className="mt-4 border-t border-[#e7eef8] pt-4">
        <div className="grid grid-cols-3 gap-2">
          <QuickSideButton
            label={localizedHome}
            teamName={homeTeam}
            odds={oddsHome}
            selected={directionPick === "HOME"}
            onSelect={() => handleSelectDirection("HOME")}
          />
          <QuickSideButton
            label={drawLabel}
            odds={oddsDraw}
            selected={directionPick === "DRAW"}
            onSelect={() => handleSelectDirection("DRAW")}
          />
          <QuickSideButton
            label={localizedAway}
            teamName={awayTeam}
            odds={oddsAway}
            selected={directionPick === "AWAY"}
            onSelect={() => handleSelectDirection("AWAY")}
          />
        </div>

        {directionPick !== null ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-[18px] border border-slate-200 bg-slate-100 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-semibold text-slate-600">
                  {tb("sideStake")}
                </label>
                <div className="inline-flex items-center rounded-[12px] border border-[#d7deea] bg-white px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <input
                    type="number"
                    min={0}
                    max={maxStake}
                    value={directionStake}
                    onChange={(event) => setDirectionStake(Number(event.target.value))}
                    className="w-16 border-0 bg-transparent text-right font-mono font-black text-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {tc("chips")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={openScoreDialog}
              className="group flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#bfdbfe] bg-white px-4 py-3 text-start shadow-[0_2px_8px_rgba(30,58,138,0.06)] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] hover:shadow-[0_6px_18px_rgba(30,58,138,0.10)] active:translate-y-px"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1E3A8A]">
                  {tb("predictScore")}
                  <span className="rounded-full bg-[#E0EEFF] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#1D4ED8]">
                    {td("optional")}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">
                  {scoreStakeNum > 0 && home !== null && away !== null && selectedScoreOdd > 0
                    ? scoreSummary(home, away, scoreStakeNum, tc("chips"), selectedScoreOdd)
                    : td("exactScoreHint")}
                </div>
              </div>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[#1D4ED8] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              >
                <path d="m7 5 5 5-5 5" />
              </svg>
            </button>

            {/* {mismatched && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {tb("mismatchWarning", {
                  side:
                    directionPick === "HOME"
                      ? localizedHome
                      : directionPick === "AWAY"
                        ? localizedAway
                        : drawLabel,
                  scoreSide:
                    scoreImpliesDirection === "HOME"
                      ? localizedHome
                      : scoreImpliesDirection === "AWAY"
                        ? localizedAway
                        : drawLabel,
                  home: home ?? 0,
                  away: away ?? 0,
                })}
              </div>
            )} */}

            {totalStake > maxStake ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {tb("notEnoughChips", { max: maxStake })}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <div className="rounded-[18px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#1E3A8A]">
                  {directionSummary}
                </span>
                <span className="font-mono text-sm font-bold text-[#1E3A8A]">
                  {totalStake} {tc("chips")}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {scoreStakeNum > 0 && selectedScoreOdd > 0
                    ? tb("payIfBoth")
                    : tb("payIfWin", { amount: directionPayout })}
                </span>
                {scoreStakeNum > 0 && selectedScoreOdd > 0 ? (
                  <span className="font-mono font-semibold text-[#1E3A8A]">
                    {bestCasePayout} {tc("chips")}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                className="rounded-full border border-[#cdd9ea] bg-white px-4 text-xs font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                disabled={!canSubmit || pending}
                onClick={submit}
                className="flex-1 rounded-[20px] bg-[#1E3A8A] px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(30,58,138,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? tb("placePending") : tc("confirm")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ExactScoreDialog
        key={`${home ?? "x"}-${away ?? "x"}-${scoreStakeNum}-${sideStakeNum}-${maxStake}`}
        open={scoreDialogOpen}
        onClose={() => setScoreDialogOpen(false)}
        onSave={({ home: nextHome, away: nextAway, stake }) => {
          setHome(nextHome);
          setAway(nextAway);
          setScoreStake(stake);
          setScoreWasCustomized(true);
          setScoreDialogOpen(false);
        }}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        initialHome={home}
        initialAway={away}
        initialStake={
          scoreWasCustomized
            ? scoreStakeNum
            : scoreStakeNum > 0
              ? scoreStakeNum
              : Math.min(sideStakeNum, Math.max(0, maxStake - sideStakeNum))
        }
        sideStake={sideStakeNum}
        maxStake={maxStake}
        choices={exactScoreChoices}
        directionPick={directionPick}
      />
    </>
  );
}

function QuickSideButton({
  label,
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
      aria-label={label}
      className={
        "flex min-w-0 items-center justify-center rounded-[18px] border px-2 py-3 transition " +
        (selected
          ? "border-[#3B82F6] bg-[#E0EEFF]"
          : "border-[#dbe5f2] bg-white hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
      }
    >
      <span className="font-mono text-base font-black text-[#1D4ED8]">
        {odds.toFixed(2)}x
      </span>
    </button>
  );
}
