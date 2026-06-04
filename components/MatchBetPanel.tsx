"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import BetForm from "@/components/BetForm";
import { useTeamName } from "@/hooks/useTeamName";
import { removeMatchBet } from "@/lib/actions/bets";
import type { MatchBet, ScoreOddsCache } from "@/lib/db/schema";

export default function MatchBetPanel({
  roomCode,
  matchId,
  matchStatus,
  kickoff,
  myBet,
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
  matchStatus: "scheduled" | "live" | "final";
  kickoff: string;
  myBet: MatchBet | null;
  homeTeam: string;
  awayTeam: string;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  scoreOdds: ScoreOddsCache | null;
  maxStake: number;
}) {
  const [now] = useState(() => Date.now());
  const [isEditing, setIsEditing] = useState(false);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const t = useTranslations("match");
  const tb = useTranslations("bet");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);
  const directionLabel = myBet
    ? myBet.directionPick === "HOME"
      ? localizedHome
      : myBet.directionPick === "AWAY"
        ? localizedAway
        : t("draw")
    : null;

  function submitRemove() {
    setRemoveError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", matchId);
    startRemove(async () => {
      try {
        await removeMatchBet(fd);
      } catch (e) {
        setRemoveError(e instanceof Error ? e.message : tb("removeFailed"));
      }
    });
  }

  const isLocked =
    new Date(kickoff).getTime() <= now || matchStatus !== "scheduled";
  const hasDirectionOdds = oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds && Object.keys(scoreOdds).length > 0;
  const hasOdds = hasDirectionOdds && hasScoreOdds;
  const canEditBet = myBet && myBet.status === "open" && !isLocked && hasOdds;

  // Edit mode renders the bet form prefilled with the existing prediction.
  // The stake cap includes the existing stake since it'll be refunded when
  // the update commits.
  if (myBet && isEditing && canEditBet) {
    return (
      <BetForm
        roomCode={roomCode}
        matchId={matchId}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        oddsHome={oddsHome!}
        oddsDraw={oddsDraw!}
        oddsAway={oddsAway!}
        scoreOdds={scoreOdds!}
        maxStake={maxStake + myBet.totalStake}
        existingBet={{
          directionPick: myBet.directionPick,
          directionStake: myBet.directionStake,
          predictedHomeScore: myBet.predictedHomeScore,
          predictedAwayScore: myBet.predictedAwayScore,
          scoreStake: myBet.scoreStake,
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  if (myBet) {
    const hasScoreBet = myBet.scoreStake > 0;

    return (
      <section className="rounded-[28px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 shadow-[0_16px_38px_rgba(59,130,246,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
            {t("yourBet")}
          </h3>
          {canEditBet && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                disabled={removing}
                className="rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#1D4ED8] transition hover:bg-[#E0EEFF] disabled:opacity-50"
              >
                {tb("edit")}
              </button>
              <button
                type="button"
                onClick={submitRemove}
                disabled={removing}
                className="rounded-full border border-red-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {removing ? tb("removePending") : tb("remove")}
              </button>
            </div>
          )}
        </div>
        {removeError && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {removeError}
          </p>
        )}
        <p className="mt-2 text-xl font-black text-[#1E3A8A]">
          {hasScoreBet
            ? `${localizedHome} ${myBet.predictedHomeScore} – ${myBet.predictedAwayScore} ${localizedAway}`
            : directionLabel}
        </p>
        {hasScoreBet ? (
          <p className="mt-1 text-sm text-slate-500">
            {tb("directionOutcome")}: {directionLabel}
          </p>
        ) : null}
        <div className={`mt-3 grid gap-3 ${hasScoreBet ? "sm:grid-cols-2" : ""}`}>
          <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {tb("directionOutcome")}
            </div>
            <div className="mt-1 text-sm text-[#1E3A8A]">
              <span className="font-bold">{myBet.directionStake} {tc("chips")}</span> @{" "}
              <span className="font-mono font-bold">
                {Number(myBet.directionOddsLocked).toFixed(2)}x
              </span>{" "}
              <span className="text-slate-500">
                ({myBet.directionOutcome === "pending" ? t("openOutcome") : myBet.directionOutcome})
              </span>
            </div>
          </div>
          {hasScoreBet ? (
            <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tb("scoreOutcome")}
              </div>
              <div className="mt-1 text-sm text-[#1E3A8A]">
                <span className="font-bold">{myBet.scoreStake} {tc("chips")}</span> @{" "}
                <span className="font-mono font-bold">
                  {Number(myBet.scoreOddsLocked).toFixed(2)}x
                </span>{" "}
                <span className="text-slate-500">
                  ({myBet.scoreOutcome === "pending" ? t("openOutcome") : myBet.scoreOutcome})
                </span>
              </div>
            </div>
          ) : null}
        </div>
        {myBet.status === "settled" && (
          <p className="mt-3 text-sm font-medium text-slate-600">
            {t("settled")}{" "}
            <span className="font-mono font-black text-[#1E3A8A]">
              {myBet.payout ?? 0}
            </span>{" "}
            {tc("chips")}.
          </p>
        )}
      </section>
    );
  }

  if (isLocked) {
    return (
      <section className="rounded-[28px] border border-[#dbe5f2] bg-[#F8FBFF] p-5 text-sm font-medium text-slate-600">
        {t("kickoffPast")}
      </section>
    );
  }

  if (!hasOdds) {
    return (
      <section className="rounded-[28px] border border-dashed border-[#cfdced] bg-white p-5 text-sm text-slate-600">
        {t("oddsNotReady")}
      </section>
    );
  }

  return (
    <BetForm
      roomCode={roomCode}
      matchId={matchId}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      oddsHome={oddsHome}
      oddsDraw={oddsDraw}
      oddsAway={oddsAway}
      scoreOdds={scoreOdds}
      maxStake={maxStake}
    />
  );
}
