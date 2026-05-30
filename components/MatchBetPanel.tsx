"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import BetForm from "@/components/BetForm";
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
  const t = useTranslations("match");
  const tb = useTranslations("bet");
  const tc = useTranslations("common");
  const teamName = useTeamName();
  const localizedHome = teamName(homeTeam);
  const localizedAway = teamName(awayTeam);

  const isLocked =
    new Date(kickoff).getTime() <= now || matchStatus !== "scheduled";
  const hasDirectionOdds = oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds;
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
          predictedHomeScore: myBet.predictedHomeScore,
          predictedAwayScore: myBet.predictedAwayScore,
          totalStake: myBet.totalStake,
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  if (myBet) {
    return (
      <section className="rounded-[28px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 shadow-[0_16px_38px_rgba(59,130,246,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
            {t("yourBet")}
          </h3>
          {canEditBet && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#1D4ED8] transition hover:bg-[#E0EEFF]"
            >
              {tb("edit")}
            </button>
          )}
        </div>
        <p className="mt-2 text-xl font-black text-[#1E3A8A]">
          {localizedHome} {myBet.predictedHomeScore} – {myBet.predictedAwayScore}{" "}
          {localizedAway}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
