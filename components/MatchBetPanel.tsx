"use client";

import { useState } from "react";
import BetForm from "@/components/BetForm";
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

  const isLocked =
    new Date(kickoff).getTime() <= now || matchStatus !== "scheduled";
  const hasDirectionOdds = oddsHome != null && oddsDraw != null && oddsAway != null;
  const hasScoreOdds = !!scoreOdds;
  const hasOdds = hasDirectionOdds && hasScoreOdds;

  if (myBet) {
    return (
      <section className="rounded-[28px] border border-[#BFDBFE] bg-[#EFF6FF] p-5 shadow-[0_16px_38px_rgba(59,130,246,0.10)]">
        <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
          Your prediction
        </h3>
        <p className="mt-2 text-xl font-black text-[#1E3A8A]">
          {homeTeam} {myBet.predictedHomeScore} – {myBet.predictedAwayScore}{" "}
          {awayTeam}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Direction
            </div>
            <div className="mt-1 text-sm text-[#1E3A8A]">
              <span className="font-bold">{myBet.directionStake} chips</span> @{" "}
              <span className="font-mono font-bold">
                {Number(myBet.directionOddsLocked).toFixed(2)}x
              </span>{" "}
              <span className="text-slate-500">
                ({myBet.directionOutcome === "pending" ? "open" : myBet.directionOutcome})
              </span>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Exact score
            </div>
            <div className="mt-1 text-sm text-[#1E3A8A]">
              <span className="font-bold">{myBet.scoreStake} chips</span> @{" "}
              <span className="font-mono font-bold">
                {Number(myBet.scoreOddsLocked).toFixed(2)}x
              </span>{" "}
              <span className="text-slate-500">
                ({myBet.scoreOutcome === "pending" ? "open" : myBet.scoreOutcome})
              </span>
            </div>
          </div>
        </div>
        {myBet.status === "settled" && (
          <p className="mt-3 text-sm font-medium text-slate-600">
            Settled. Payout:{" "}
            <span className="font-mono font-black text-[#1E3A8A]">
              {myBet.payout ?? 0}
            </span>{" "}
            chips.
          </p>
        )}
      </section>
    );
  }

  if (isLocked) {
    return (
      <section className="rounded-[28px] border border-[#dbe5f2] bg-[#F8FBFF] p-5 text-sm font-medium text-slate-600">
        Betting closed. Kickoff has already passed.
      </section>
    );
  }

  if (!hasOdds) {
    return (
      <section className="rounded-[28px] border border-dashed border-[#cfdced] bg-white p-5 text-sm text-slate-600">
        Odds haven&apos;t been generated yet. Ask any room member to run{" "}
        <code className="rounded bg-[#F8FBFF] px-1.5 py-0.5 font-mono text-xs text-[#1E3A8A] ring-1 ring-[#dbe5f2]">
          npm run odds:generate
        </code>{" "}
        or hit &quot;Generate odds&quot; on the admin page.
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
