import Link from "next/link";
import type { Match } from "@/lib/db/schema";
import TeamFlag from "@/components/TeamFlag";

function formatKickoff(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MatchCard({
  match,
  roomCode,
  myPrediction,
}: {
  match: Match;
  roomCode: string;
  myPrediction?: { home: number; away: number } | null;
}) {
  const kickoff = new Date(match.kickoff);
  const isFinal = match.status === "final";
  const isLive = match.status === "live";
  const centerLabel =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} : ${match.awayScore}`
      : "VS";
  const stateLabel = isLive ? "LIVE" : isFinal ? "FINAL" : "UP NEXT";
  const stateClass = isLive
    ? "bg-[#FFF1E8] text-[#EA580C]"
    : isFinal
      ? "bg-slate-200 text-slate-700"
      : "bg-[#E0EEFF] text-[#1D4ED8]";

  return (
    <Link
      href={`/r/${roomCode}/match/${match.id}`}
      className="group block rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)] transition hover:-translate-y-0.5 hover:border-[#c4d6ec] hover:shadow-[0_24px_50px_rgba(30,58,138,0.14)]"
    >
      <div className="flex items-center justify-between gap-3 text-[0.7rem] uppercase tracking-[0.24em] text-slate-500">
        <span className="font-semibold">Group {match.groupLabel}</span>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${stateClass}`}
          >
            {isLive && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {stateLabel}
          </span>
          <span className="hidden font-medium normal-case tracking-normal text-slate-500 sm:inline">
            {formatKickoff(kickoff)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="min-w-0 max-w-[6.5rem] sm:max-w-[11rem]">
            <div className="break-words text-base font-black leading-tight text-[#1E3A8A] sm:text-lg">
              {match.homeTeam}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Home
            </div>
          </div>
          <TeamFlag teamName={match.homeTeam} size={34} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-[#F8FBFF] px-4 py-1.5 font-mono text-sm font-black tracking-[0.22em] text-[#1E3A8A] ring-1 ring-[#dbe5f2]">
            {centerLabel}
          </span>
          {!isLive && !isFinal && (
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:hidden">
              {formatKickoff(kickoff)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamFlag teamName={match.awayTeam} size={34} />
          <div className="min-w-0 max-w-[6.5rem] sm:max-w-[11rem]">
            <div className="break-words text-base font-black leading-tight text-[#1E3A8A] sm:text-lg">
              {match.awayTeam}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Away
            </div>
          </div>
        </div>
      </div>

      {myPrediction && (
        <div className="mt-4 inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-xs font-bold text-[#EA580C]">
          Your prediction: {myPrediction.home} – {myPrediction.away}
        </div>
      )}
    </Link>
  );
}
