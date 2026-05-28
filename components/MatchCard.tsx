import Link from "next/link";
import type { Match } from "@/lib/db/schema";

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

  return (
    <Link
      href={`/r/${roomCode}/match/${match.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Group {match.groupLabel}</span>
        <span>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          )}
          {!isLive && !isFinal && <span>{formatKickoff(kickoff)}</span>}
          {isFinal && (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              FINAL
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-base font-medium">
        <span>{match.homeTeam}</span>
        {match.homeScore != null && match.awayScore != null ? (
          <span className="font-mono">
            {match.homeScore} : {match.awayScore}
          </span>
        ) : (
          <span className="text-zinc-400">vs</span>
        )}
        <span>{match.awayTeam}</span>
      </div>
      {myPrediction && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Your prediction: {myPrediction.home} – {myPrediction.away}
        </div>
      )}
    </Link>
  );
}
