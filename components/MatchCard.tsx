import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Match } from "@/lib/db/schema";
import TeamFlag from "@/components/TeamFlag";
import LocalDateTime from "@/components/LocalDateTime";
import { getTeamAbbreviation } from "@/lib/team-flags";
import { useTeamName } from "@/hooks/useTeamName";

export default function MatchCard({
  match,
  roomCode,
  myPrediction,
}: {
  match: Match;
  roomCode: string;
  myPrediction?: { home: number; away: number } | null;
}) {
  const tm = useTranslations("match");
  const td = useTranslations("dashboard");
  const teamName = useTeamName();
  const kickoff = new Date(match.kickoff);
  const isFinal = match.status === "final";
  const isLive = match.status === "live";
  const homeTeamAbbreviation = getTeamAbbreviation(match.homeTeam);
  const awayTeamAbbreviation = getTeamAbbreviation(match.awayTeam);
  const centerLabel =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} : ${match.awayScore}`
      : tm("vs");
  const stateLabel = isLive ? tm("live") : isFinal ? tm("final") : tm("upNext");
  const stateClass = isLive
    ? "bg-[#FFF1E8] text-[#EA580C]"
    : isFinal
      ? "bg-slate-200 text-slate-700"
      : "bg-[#E0EEFF] text-[#1D4ED8]";
  const matchHref = `/r/${roomCode}/match/${match.id}?from=dashboard`;

  return (
    <Link
      href={matchHref}
      className="group block rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)] transition hover:-translate-y-0.5 hover:border-[#c4d6ec] hover:shadow-[0_24px_50px_rgba(30,58,138,0.14)]"
    >
      <div className="flex items-center justify-between gap-3 text-[0.7rem] uppercase tracking-[0.24em] text-slate-500">
        <span className="font-semibold">{tm("group")} {match.groupLabel}</span>
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
            <LocalDateTime value={kickoff} preset="kickoffShort" />
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,35%)_minmax(0,30%)_minmax(0,35%)] items-center gap-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
        <div className="min-w-0">
          <div className="flex w-full items-center justify-end gap-2 whitespace-nowrap text-right sm:hidden">
            <span className="shrink-0 text-[0.95rem] font-black leading-tight text-[#1E3A8A]">
              {homeTeamAbbreviation}
            </span>
            <TeamFlag teamName={match.homeTeam} size={30} />
          </div>

          <div className="hidden min-w-0 items-center justify-end gap-3 text-right sm:flex">
            <div className="min-w-0 max-w-[11rem]">
              <div className="break-words text-lg font-black leading-tight text-[#1E3A8A]">
                {teamName(match.homeTeam)}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {tm("home")}
              </div>
            </div>
            <TeamFlag teamName={match.homeTeam} size={34} />
          </div>
        </div>

        <div className="flex items-center justify-center sm:flex-col sm:gap-2">
          <span className="rounded-full bg-[#F8FBFF] px-3.5 py-1.5 font-mono text-sm font-black tracking-[0.22em] text-[#1E3A8A] ring-1 ring-[#dbe5f2]">
            {centerLabel}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex w-full items-center justify-start gap-2 whitespace-nowrap sm:hidden">
            <TeamFlag teamName={match.awayTeam} size={30} />
            <span className="shrink-0 text-[0.95rem] font-black leading-tight text-[#1E3A8A]">
              {awayTeamAbbreviation}
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <TeamFlag teamName={match.awayTeam} size={34} />
            <div className="min-w-0 max-w-[11rem]">
              <div className="break-words text-lg font-black leading-tight text-[#1E3A8A]">
                {teamName(match.awayTeam)}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {tm("away")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isLive && !isFinal && (
        <div className="mt-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:hidden">
          <LocalDateTime value={kickoff} preset="kickoffShort" />
        </div>
      )}

      {myPrediction && (
        <div className="mt-4 inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-xs font-bold text-[#EA580C]">
          {td("yourPrediction")}: {myPrediction.home} – {myPrediction.away}
        </div>
      )}
    </Link>
  );
}
