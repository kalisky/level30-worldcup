"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import TeamFlag from "@/components/TeamFlag";
import { StakeRow } from "@/components/QuickBetForm";
import ApplyToAllRoomsToggle from "@/components/ApplyToAllRoomsToggle";
import { useTeamName } from "@/hooks/useTeamName";
import {
  quickBetActiveParts,
  quickBetTotal,
  useQuickBet,
  type QuickBetDirection,
} from "@/hooks/useQuickBet";
import { parseScoreKey, scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

export type DashboardQuickBetExisting = {
  directionPick: "HOME" | "DRAW" | "AWAY";
  directionStake: number;
  directionOddsLocked?: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  scoreStake: number;
  scoreOddsLocked?: number;
  totalStake: number;
  status?: "open" | "settled" | "void";
  directionOutcome?: "pending" | "won" | "lost";
  scoreOutcome?: "pending" | "won" | "lost";
  payout?: number | null;
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

/**
 * One leg (side or exact score) of a placed bet: pick, stake, locked odds,
 * and — once settled — its won/lost outcome and what it returned. Spelling
 * out both legs is what makes a net like "won the side but still lost
 * overall" legible.
 */
function BetLegRow({
  label,
  pick,
  stake,
  odds,
  outcome,
  returned,
  chipsLabel,
}: {
  label: string;
  pick: string;
  stake: number;
  odds: number;
  outcome?: "pending" | "won" | "lost";
  returned: number;
  chipsLabel: string;
}) {
  const won = outcome === "won";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-slate-600">
        <span className="font-semibold text-slate-500">{label}:</span>{" "}
        <span className="font-bold text-[#1E3A8A]">{pick}</span> · {stake}{" "}
        {chipsLabel}
        {odds > 0 ? (
          <span className="font-mono"> · {odds.toFixed(2)}x</span>
        ) : null}
      </span>
      {outcome && outcome !== "pending" ? (
        <span
          className={
            "shrink-0 font-mono font-bold " +
            (won ? "text-emerald-600" : "text-red-500")
          }
        >
          {won ? `✓ +${returned}` : "✗ 0"}
        </span>
      ) : null}
    </div>
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
  onClear,
  homeTeam,
  awayTeam,
  initialHome,
  initialAway,
  initialStake,
  sideStake,
  maxStake,
  choices,
  isKnockout = false,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (value: { home: number; away: number; stake: number }) => void;
  /** Present when there's a committed score bet that can be removed. */
  onClear?: () => void;
  homeTeam: string;
  awayTeam: string;
  initialHome: number | null;
  initialAway: number | null;
  initialStake: number;
  sideStake: number;
  maxStake: number;
  choices: ExactScoreChoice[];
  isKnockout?: boolean;
}) {
  const tb = useTranslations("bet");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
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
          {isKnockout && (
            <div className="flex items-start gap-2 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm font-medium text-[#1E3A8A]">
              <span aria-hidden>⏱️</span>
              <span>{tb("scoreLegalTimeNote")}</span>
            </div>
          )}
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

          <div>
            <StakeRow
              label={tb("scoreStakeLabel")}
              stake={stakeNum}
              payout={Math.ceil(stakeNum * selectedScoreOdd)}
              payoutLabel={
                selectedScoreOdd > 0
                  ? `${selectedScoreOdd.toFixed(2)}x · ${tb("payIfExact", {
                      amount: Math.ceil(stakeNum * selectedScoreOdd),
                    })}`
                  : ""
              }
              maxStake={Math.max(2, maxStake - sideStake)}
              onChange={setStake}
            />

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
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-[24px] border border-red-200 bg-white px-4 py-3 font-bold text-red-600 transition hover:bg-red-50"
            >
              {tb("clearScore")}
            </button>
          )}
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
  defaultDirectionStake,
  defaultScoreStake,
  otherRoomCount = 0,
  isKnockout = false,
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
  defaultDirectionStake?: number | null;
  defaultScoreStake?: number | null;
  /** Rooms the user belongs to besides this one — gates the cross-room toggle. */
  otherRoomCount?: number;
  /** Knockout match: 2-way "advances" side (no draw), score is legal-time. */
  isKnockout?: boolean;
}) {
  const tb = useTranslations("bet");
  const td = useTranslations("dashboard");
  const tm = useTranslations("match");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
  const drawLabel = tm("draw");
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);

  const isLocked = matchStatus !== "scheduled" || new Date(kickoff).getTime() <= now;
  const hasDirectionOdds = isKnockout
    ? oddsHome != null && oddsAway != null
    : oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds && Object.keys(scoreOdds).length > 0;
  const hasOdds = hasDirectionOdds && hasScoreOdds;

  // Chips in hand plus the already-staked amount a change would re-spend.
  // The server re-validates on every save regardless.
  const budget = maxStake + (myBet?.totalStake ?? 0);

  const { desired, apply, status, error, notice } = useQuickBet({
    roomCode,
    matchId,
    existing: myBet ?? null,
    defaultDirectionStake: defaultDirectionStake ?? null,
    defaultScoreStake: defaultScoreStake ?? null,
    budget,
    overBudgetMessage: tb("notEnoughChips", { max: budget }),
  });

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

  const { hasDirection, hasScore } = quickBetActiveParts(desired);
  const selectedKey =
    desired.home !== null && desired.away !== null
      ? scoreKey(desired.home, desired.away)
      : null;
  const selectedScoreOdd =
    selectedKey != null
      ? exactScoreChoices.find((choice) => choice.key === selectedKey)?.odd ?? 0
      : 0;
  const directionOdds =
    desired.pick === "HOME"
      ? oddsHome ?? 0
      : desired.pick === "DRAW"
        ? oddsDraw ?? 0
        : desired.pick === "AWAY"
          ? oddsAway ?? 0
          : 0;
  const directionPayout = Math.ceil(desired.sideStake * directionOdds);
  const totalStake = quickBetTotal(desired);

  // Popup default when no score is picked yet, matching the side bet:
  // HOME → 1-0, AWAY → 0-1, DRAW or no pick → 0-0 (when that line exists).
  const preferredDefault =
    desired.pick === "HOME"
      ? { home: 1, away: 0 }
      : desired.pick === "AWAY"
        ? { home: 0, away: 1 }
        : { home: 0, away: 0 };
  const suggestedScore = exactScoreChoices.some(
    (c) => c.home === preferredDefault.home && c.away === preferredDefault.away
  )
    ? preferredDefault
    : null;

  function togglePick(pick: QuickBetDirection) {
    apply({ pick: desired.pick === pick ? null : pick }, 150);
  }

  // Locked matches show what was bet, read-only.
  if (isLocked || !hasOdds) {
    if (!myBet) return null;
    const sideLabel = directionLabel(
      myBet.directionPick,
      localizedHome,
      localizedAway,
      drawLabel
    );
    const hasDirectionBet = myBet.directionStake > 0;
    const hasScoreBet = myBet.scoreStake > 0;
    const isSettled = myBet.status === "settled";
    const net = isSettled ? (myBet.payout ?? 0) - myBet.totalStake : 0;

    // Locked-in odds the bet was placed at — fall back to the live cache for
    // older rows that predate carrying them on the bet.
    const directionOdds =
      myBet.directionOddsLocked ??
      (myBet.directionPick === "HOME"
        ? oddsHome ?? 0
        : myBet.directionPick === "AWAY"
          ? oddsAway ?? 0
          : oddsDraw ?? 0);
    const scoreOdd =
      myBet.scoreOddsLocked ??
      Number(
        scoreOdds?.[scoreKey(myBet.predictedHomeScore, myBet.predictedAwayScore)] ?? 0
      );

    const directionReturn = Math.ceil(myBet.directionStake * directionOdds);
    const scoreReturn = Math.ceil(myBet.scoreStake * scoreOdd);

    return (
      <div className="mt-4 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            {tm("yourBet")}
          </span>
          {isSettled ? (
            <span
              className={
                "rounded-full px-2.5 py-0.5 font-mono text-sm font-black " +
                (net >= 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-600")
              }
            >
              {net >= 0
                ? tb("wonAmount", { amount: `+${net}` })
                : tb("lostAmount", { amount: net })}
            </span>
          ) : (
            <span className="font-mono text-xs font-bold text-[#1D4ED8]">
              {myBet.totalStake} {tc("chips")}
            </span>
          )}
        </div>
        <div className="mt-2 space-y-1.5">
          {hasDirectionBet && (
            <BetLegRow
              label={tb("directionOutcome")}
              pick={sideLabel}
              stake={myBet.directionStake}
              odds={directionOdds}
              outcome={isSettled ? myBet.directionOutcome : undefined}
              returned={directionReturn}
              chipsLabel={tc("chips")}
            />
          )}
          {hasScoreBet && (
            <BetLegRow
              label={tb("scoreOutcome")}
              pick={`${myBet.predictedHomeScore}–${myBet.predictedAwayScore}`}
              stake={myBet.scoreStake}
              odds={scoreOdd}
              outcome={isSettled ? myBet.scoreOutcome : undefined}
              returned={scoreReturn}
              chipsLabel={tc("chips")}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 border-t border-[#e7eef8] pt-4">
        <div className={`grid gap-2 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}>
          <QuickSideButton
            label={localizedHome}
            teamName={homeTeam}
            odds={oddsHome ?? 0}
            selected={desired.pick === "HOME"}
            onSelect={() => togglePick("HOME")}
          />
          {!isKnockout && (
            <QuickSideButton
              label={drawLabel}
              odds={oddsDraw ?? 0}
              selected={desired.pick === "DRAW"}
              onSelect={() => togglePick("DRAW")}
            />
          )}
          <QuickSideButton
            label={localizedAway}
            teamName={awayTeam}
            odds={oddsAway ?? 0}
            selected={desired.pick === "AWAY"}
            onSelect={() => togglePick("AWAY")}
          />
        </div>

        {(hasDirection || hasScore) && (
          <div className="mt-1 space-y-2">
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

            <button
              type="button"
              onClick={() => setScoreDialogOpen(true)}
              className="group flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#bfdbfe] bg-white px-4 py-3 text-start shadow-[0_2px_8px_rgba(30,58,138,0.06)] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] hover:shadow-[0_6px_18px_rgba(30,58,138,0.10)] active:translate-y-px"
            >
              <div className="min-w-0">
                {hasScore && selectedScoreOdd > 0 ? (
                  <div className="flex items-baseline gap-2 truncate">
                    <span className="font-mono text-2xl font-black leading-none text-[#1E3A8A]">
                      {desired.home}–{desired.away}
                    </span>
                    <span className="text-xs text-slate-500">
                      {desired.scoreStake} {tc("chips")} · {selectedScoreOdd.toFixed(2)}x
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#1E3A8A]">
                      {tb("predictScore")}
                      <span className="rounded-full bg-[#E0EEFF] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#1D4ED8]">
                        {td("optional")}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {td("exactScoreHint")}
                    </div>
                  </>
                )}
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

            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-2.5 text-xs">
              <span className="font-semibold text-slate-600">
                {tb("totalStake")}:{" "}
                <span className="font-mono font-black text-[#1E3A8A]">
                  {totalStake} {tc("chips")}
                </span>
              </span>
              <span
                className={
                  "font-bold uppercase tracking-[0.16em] " +
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

            <ApplyToAllRoomsToggle otherRoomCount={otherRoomCount} />

            {error ? (
              <p className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {notice ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-3 text-sm font-medium text-amber-900">
                {tb("syncFailed", { rooms: notice })}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <ExactScoreDialog
        key={`${desired.home ?? "x"}-${desired.away ?? "x"}-${desired.scoreStake}-${desired.sideStake}-${desired.pick ?? "x"}`}
        open={scoreDialogOpen}
        onClose={() => setScoreDialogOpen(false)}
        onSave={({ home: nextHome, away: nextAway, stake }) => {
          apply({ home: nextHome, away: nextAway, scoreStake: stake }, 150);
          setScoreDialogOpen(false);
        }}
        onClear={
          hasScore
            ? () => {
                apply({ home: null, away: null }, 150);
                setScoreDialogOpen(false);
              }
            : undefined
        }
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        initialHome={desired.home ?? suggestedScore?.home ?? null}
        initialAway={desired.away ?? suggestedScore?.away ?? null}
        initialStake={desired.scoreStake}
        sideStake={hasDirection ? desired.sideStake : 0}
        maxStake={budget}
        choices={exactScoreChoices}
        isKnockout={isKnockout}
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
