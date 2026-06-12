"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import QuickBetForm from "@/components/QuickBetForm";
import { useTeamName } from "@/hooks/useTeamName";
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
  defaultDirectionStake,
  defaultScoreStake,
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
  defaultDirectionStake: number | null;
  defaultScoreStake: number | null;
}) {
  const [now] = useState(() => Date.now());
  const t = useTranslations("match");
  const tb = useTranslations("bet");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);

  const isLocked =
    new Date(kickoff).getTime() <= now || matchStatus !== "scheduled";
  const hasDirectionOdds = oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds && Object.keys(scoreOdds).length > 0;
  const hasOdds = hasDirectionOdds && hasScoreOdds;

  // Open match with odds → the quick-bet editor; every interaction saves
  // instantly, so there's no separate placed-bet summary or edit mode.
  if (!isLocked && hasOdds && (!myBet || myBet.status === "open")) {
    return (
      <QuickBetForm
        roomCode={roomCode}
        matchId={matchId}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        oddsHome={oddsHome!}
        oddsDraw={oddsDraw!}
        oddsAway={oddsAway!}
        scoreOdds={scoreOdds!}
        maxStake={maxStake}
        existingBet={myBet}
        defaultDirectionStake={defaultDirectionStake}
        defaultScoreStake={defaultScoreStake}
      />
    );
  }

  if (myBet) {
    const hasDirectionBet = myBet.directionStake > 0;
    const hasScoreBet = myBet.scoreStake > 0;
    const directionLabel =
      myBet.directionPick === "HOME"
        ? localizedHome
        : myBet.directionPick === "AWAY"
          ? localizedAway
          : t("draw");

    return (
      <section className="rounded-[28px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 shadow-[0_16px_38px_rgba(59,130,246,0.10)]">
        <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
          {t("yourBet")}
        </h3>
        <p className="mt-2 text-xl font-black text-[#1E3A8A]">
          {hasScoreBet
            ? `${localizedHome} ${myBet.predictedHomeScore} – ${myBet.predictedAwayScore} ${localizedAway}`
            : directionLabel}
        </p>
        {hasScoreBet && hasDirectionBet ? (
          <p className="mt-1 text-sm text-slate-500">
            {tb("directionOutcome")}: {directionLabel}
          </p>
        ) : null}
        <div className={`mt-3 grid gap-3 ${hasDirectionBet && hasScoreBet ? "sm:grid-cols-2" : ""}`}>
          {hasDirectionBet ? (
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
          ) : null}
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

  return (
    <section className="rounded-[28px] border border-dashed border-[#cfdced] bg-white p-5 text-sm text-slate-600">
      {t("oddsNotReady")}
    </section>
  );
}
