"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Match } from "@/lib/db/schema";
import LocalDateTime from "@/components/LocalDateTime";
import { renameMatchTeams, regenerateMatchOdds } from "@/lib/actions/settle";

export default function SettleMatchForm({
  match,
  roomCode,
}: {
  match: Match;
  roomCode: string;
}) {
  const t = useTranslations("admin");
  const tm = useTranslations("match");
  const [now] = useState(() => Date.now());
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

  function submitRename() {
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    fd.set("homeTeam", homeTeam);
    fd.set("awayTeam", awayTeam);
    runAction(renameMatchTeams, fd, "Renamed. Re-sync odds.");
  }

  function submitOdds() {
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("matchId", match.id);
    runAction(regenerateMatchOdds, fd, "Odds synced.");
  }

  const isFinal = match.status === "final";
  const kickedOff = new Date(match.kickoff).getTime() <= now;

  return (
    <div className="rounded-[26px] border border-[#dbe5f2] bg-white p-4 shadow-[0_14px_32px_rgba(30,58,138,0.07)]">
      <div className="flex items-center justify-between text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span>{tm("group")} {match.groupLabel}</span>
        <span><LocalDateTime value={match.kickoff} preset="kickoffShort" /></span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          dir="auto"
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
        />
        <span className="font-bold text-slate-400">{tm("vs")}</span>
        <input
          type="text"
          dir="auto"
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
          {t("saveNames")}
        </button>
        <button
          type="button"
          onClick={submitOdds}
          disabled={pending || isFinal}
          className="rounded-full border border-[#cdd9ea] px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
        >
          {match.oddsHome ? t("regenerateOdds") : t("generateOdds")}
        </button>
        {match.oddsHome && (
          <span className="font-mono font-semibold text-slate-500">
            H {Number(match.oddsHome).toFixed(2)} / D {Number(match.oddsDraw).toFixed(2)} / A{" "}
            {Number(match.oddsAway).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {isFinal ? (
          <>
            <span className="text-sm font-semibold text-slate-600">{t("finalScore")}</span>
            <span className="font-mono font-bold text-[#1E3A8A]">
              {match.homeScore} : {match.awayScore}
            </span>
            <span className="ml-auto rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
              {tm("final")}
            </span>
          </>
        ) : kickedOff ? (
          <span className="ml-auto rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            {t("awaitingAutoSettle")}
          </span>
        ) : null}
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
