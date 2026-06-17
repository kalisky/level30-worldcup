"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Match } from "@/lib/db/schema";
import TeamFlag from "@/components/TeamFlag";
import LocalDateTime from "@/components/LocalDateTime";
import DashboardQuickBet, {
  type DashboardQuickBetExisting,
} from "@/components/DashboardQuickBet";
import { getTeamAbbreviation } from "@/lib/team-flags";
import { useTeamName } from "@/hooks/useTeamName";

export type MatchCardMatch = Omit<
  Pick<
  Match,
  | "id"
  | "groupLabel"
  | "homeTeam"
  | "awayTeam"
  | "kickoff"
  | "status"
  | "homeScore"
  | "awayScore"
  >,
  "kickoff"
> & {
  kickoff: Match["kickoff"] | string | number;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  scoreOdds: Match["scoreOdds"] | null;
};

export default function MatchCard({
  match,
  roomCode,
  myBet,
  customBetCount = 0,
  maxStake,
  now,
  defaultDirectionStake,
  defaultScoreStake,
  otherRoomCount = 0,
}: {
  match: MatchCardMatch;
  roomCode: string;
  myBet?: DashboardQuickBetExisting | null;
  customBetCount?: number;
  maxStake: number;
  now: number;
  defaultDirectionStake?: number | null;
  defaultScoreStake?: number | null;
  otherRoomCount?: number;
}) {
  const tm = useTranslations("match");
  const teamName = useTeamName();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tooltipOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!tooltipRef.current) return;
      if (tooltipRef.current.contains(event.target as Node)) return;
      setTooltipOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [tooltipOpen]);

  const kickoff = new Date(match.kickoff);
  const isFinal = match.status === "final";
  // A match is "in progress" once kickoff passes and before it's settled —
  // nothing flips the status to "live", so derive it from the clock. (now is
  // 0 until hydration; treat that as not-yet-live to avoid an SSR flash.)
  const isLive =
    !isFinal && (match.status === "live" || (now > 0 && kickoff.getTime() <= now));
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
    <article
      className={
        isFinal
          ? "group rounded-[28px] border border-[#e3eaf4] bg-[#F6F9FD] p-5 opacity-90 transition"
          : "group rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)] transition hover:-translate-y-0.5 hover:border-[#c4d6ec] hover:shadow-[0_24px_50px_rgba(30,58,138,0.14)]"
      }
    >
      <Link href={matchHref} className="block">
        <div className="flex items-center justify-between gap-3 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {tm("group")} {match.groupLabel}
            </span>
            {customBetCount > 0 && (
              <div ref={tooltipRef} className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setTooltipOpen((open) => !open);
                  }}
                  title={tm("customBetTooltip")}
                  aria-label={`${tm("customBetCount", { count: customBetCount })} — ${tm("customBetTooltip")}`}
                  aria-expanded={tooltipOpen}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[11px] font-bold text-[#EA580C] transition hover:bg-[#FFE5D5]"
                >
                  <span aria-hidden="true">🎲</span>
                  {customBetCount}
                  <span aria-hidden="true" className="font-bold text-[#FB923C] sm:opacity-70">
                    ⓘ
                  </span>
                </button>
                {tooltipOpen && (
                  <div
                    role="tooltip"
                    className="absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-[#dbe5f2] bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.18)] rtl:left-auto rtl:right-0"
                  >
                    {tm("customBetTooltip")}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums text-slate-500">
              <LocalDateTime value={kickoff} preset="time24" />
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] ${stateClass}`}
            >
              {isLive && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              {stateLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,35%)_minmax(0,30%)_minmax(0,35%)] items-center gap-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
          <div className="min-w-0">
            <div className="flex w-full items-center justify-end gap-2 whitespace-nowrap text-right sm:hidden">
              <span className="shrink-0 text-2xl font-black leading-tight text-[#1E3A8A]">
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
              <span className="shrink-0 text-2xl font-black leading-tight text-[#1E3A8A]">
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
      </Link>

      <DashboardQuickBet
        roomCode={roomCode}
        matchId={match.id}
        matchStatus={match.status}
        kickoff={kickoff.toISOString()}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        oddsHome={match.oddsHome != null ? Number(match.oddsHome) : null}
        oddsDraw={match.oddsDraw != null ? Number(match.oddsDraw) : null}
        oddsAway={match.oddsAway != null ? Number(match.oddsAway) : null}
        scoreOdds={match.scoreOdds ?? null}
        maxStake={maxStake}
        defaultDirectionStake={defaultDirectionStake}
        defaultScoreStake={defaultScoreStake}
        now={now}
        myBet={myBet}
        otherRoomCount={otherRoomCount}
      />

      {isLive && (
        <Link
          href={`${matchHref}&tab=custom`}
          className="mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-[#FBD9C0] bg-[linear-gradient(135deg,#FFF7ED_0%,#FFF1E8_100%)] px-4 py-3 transition hover:border-[#F97316] hover:shadow-[0_8px_20px_rgba(249,115,22,0.14)]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-xl" aria-hidden>
              🎲
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-black text-[#EA580C]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {tm("liveBetsTitle")}
              </div>
              <p className="mt-0.5 truncate text-xs text-[#9A3412]">
                {customBetCount > 0
                  ? tm("liveBetsJoin", { count: customBetCount })
                  : tm("liveBetsPropose")}
              </p>
            </div>
          </div>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-[#EA580C] rtl:rotate-180"
          >
            <path d="m7 5 5 5-5 5" />
          </svg>
        </Link>
      )}
    </article>
  );
}
