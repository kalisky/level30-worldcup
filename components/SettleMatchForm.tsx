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
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Group {match.groupLabel}</span>
        <span>{new Date(match.kickoff).toLocaleString()}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span className="text-zinc-400">vs</span>
        <input
          type="text"
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={submitRename}
          disabled={pending || (homeTeam === match.homeTeam && awayTeam === match.awayTeam)}
          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
        >
          Save names
        </button>
        <button
          type="button"
          onClick={submitOdds}
          disabled={pending || isFinal}
          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
        >
          {match.oddsHome ? "Regenerate odds" : "Generate odds"}
        </button>
        {match.oddsHome && (
          <span className="font-mono text-zinc-500">
            H {Number(match.oddsHome).toFixed(2)} / D {Number(match.oddsDraw).toFixed(2)} / A{" "}
            {Number(match.oddsAway).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-zinc-500">Final score:</span>
        <input
          type="number"
          min={0}
          max={99}
          value={homeScore}
          onChange={(e) => setHomeScore(Number(e.target.value))}
          className="w-14 rounded border border-zinc-300 px-2 py-1 text-right font-mono dark:border-zinc-700 dark:bg-zinc-950"
          disabled={isFinal}
        />
        <span>:</span>
        <input
          type="number"
          min={0}
          max={99}
          value={awayScore}
          onChange={(e) => setAwayScore(Number(e.target.value))}
          className="w-14 rounded border border-zinc-300 px-2 py-1 text-right font-mono dark:border-zinc-700 dark:bg-zinc-950"
          disabled={isFinal}
        />
        {isFinal ? (
          <span className="ml-auto rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
            FINAL
          </span>
        ) : (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={submitSuggest}
              disabled={pending}
              title="Use AI + web search to look up the score"
              className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Suggest with AI
            </button>
            <button
              type="button"
              onClick={submitSettle}
              disabled={pending}
              className="rounded bg-zinc-900 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              Settle
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>
      )}
      {info && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">{info}</p>
      )}
    </div>
  );
}
