"use client";

import { useState, useTransition } from "react";
import type { Match } from "@/lib/db/schema";
import {
  settleMatch,
  renameMatchTeams,
  regenerateMatchOdds,
  suggestMatchResult,
} from "@/lib/actions/settle";

export default function SettleMatchForm({
  match,
  roomCode,
}: {
  match: Match;
  roomCode: string;
}) {
  const [homeScore, setHomeScore] = useState<number>(match.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState<number>(match.awayScore ?? 0);
  const [homeTeam, setHomeTeam] = useState(match.homeTeam);
  const [awayTeam, setAwayTeam] = useState(match.awayTeam);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function runAction(action: (fd: FormData) => Promise<unknown>, fd: FormData, okMsg?: string) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        await action(fd);
        if (okMsg) setInfo(okMsg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function submitSettle() {
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    fd.set("homeScore", String(homeScore));
    fd.set("awayScore", String(awayScore));
    runAction(settleMatch, fd, "Settled.");
  }

  function submitRename() {
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    fd.set("homeTeam", homeTeam);
    fd.set("awayTeam", awayTeam);
    runAction(renameMatchTeams, fd, "Renamed. Re-run AI odds.");
  }

  function submitOdds() {
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    runAction(regenerateMatchOdds, fd, "Odds regenerated.");
  }

  function submitSuggest() {
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    startTransition(async () => {
      try {
        const result = await suggestMatchResult(fd);
        if (result.found && result.homeScore != null && result.awayScore != null) {
          setHomeScore(result.homeScore);
          setAwayScore(result.awayScore);
          setInfo(`AI suggests ${result.homeScore} – ${result.awayScore}. ${result.reasoning}`);
        } else {
          setError(`AI couldn't determine the score. ${result.reasoning}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Suggest failed.");
      }
    });
  }

  const isFinal = match.status === "final";

  return (
    <div className="rounded-[26px] border border-[#dbe5f2] bg-white p-4 shadow-[0_14px_32px_rgba(30,58,138,0.07)]">
      <div className="flex items-center justify-between text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span>Group {match.groupLabel}</span>
        <span>{new Date(match.kickoff).toLocaleString()}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
        />
        <span className="font-bold text-slate-400">vs</span>
        <input
          type="text"
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={submitRename}
          disabled={pending || (homeTeam === match.homeTeam && awayTeam === match.awayTeam)}
          className="rounded-full border border-[#cdd9ea] px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
        >
          Save names
        </button>
        <button
          type="button"
          onClick={submitOdds}
          disabled={pending || isFinal}
          className="rounded-full border border-[#cdd9ea] px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
        >
          {match.oddsHome ? "Regenerate odds" : "Generate odds"}
        </button>
        {match.oddsHome && (
          <span className="font-mono font-semibold text-slate-500">
            H {Number(match.oddsHome).toFixed(2)} / D {Number(match.oddsDraw).toFixed(2)} / A{" "}
            {Number(match.oddsAway).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-600">Final score:</span>
        <input
          type="number"
          min={0}
          max={99}
          value={homeScore}
          onChange={(e) => setHomeScore(Number(e.target.value))}
          className="w-14 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-2 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          disabled={isFinal}
        />
        <span>:</span>
        <input
          type="number"
          min={0}
          max={99}
          value={awayScore}
          onChange={(e) => setAwayScore(Number(e.target.value))}
          className="w-14 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-2 py-2 text-right font-mono font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          disabled={isFinal}
        />
        {isFinal ? (
          <span className="ml-auto rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
            FINAL
          </span>
        ) : (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={submitSuggest}
              disabled={pending}
              title="Use AI + web search to look up the score"
              className="rounded-full border border-[#cdd9ea] px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
            >
              Suggest with AI
            </button>
            <button
              type="button"
              onClick={submitSettle}
              disabled={pending}
              className="rounded-full bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)] disabled:opacity-50"
            >
              Settle
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {info && (
        <p className="mt-3 rounded-2xl bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#1D4ED8]">
          {info}
        </p>
      )}
    </div>
  );
}
