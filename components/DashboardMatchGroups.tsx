"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import LocalDateTime from "@/components/LocalDateTime";
import MatchCard, {
  type MatchCardMatch,
} from "@/components/MatchCard";
import type { DashboardQuickBetExisting } from "@/components/DashboardQuickBet";
import { groupMatchesByLocalDate } from "@/lib/dashboard-match-groups";

let currentNow = Date.now();
let nowTimer: number | null = null;
const nowListeners = new Set<() => void>();

function subscribeToHydration() {
  return () => {};
}

function emitNowChange() {
  for (const listener of nowListeners) {
    listener();
  }
}

function subscribeToNow(listener: () => void) {
  nowListeners.add(listener);
  currentNow = Date.now();

  if (nowTimer == null) {
    nowTimer = window.setInterval(() => {
      currentNow = Date.now();
      emitNowChange();
    }, 60_000);
  }

  return () => {
    nowListeners.delete(listener);
    if (nowListeners.size === 0 && nowTimer != null) {
      window.clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

function getNowSnapshot() {
  return currentNow;
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 5.2v3.1l2 1.2" />
    </svg>
  );
}

export default function DashboardMatchGroups({
  matches,
  roomCode,
  myBets,
  customBetCounts,
  maxStake,
  defaultDirectionStake,
  defaultScoreStake,
}: {
  matches: MatchCardMatch[];
  roomCode: string;
  myBets: Record<string, DashboardQuickBetExisting | null | undefined>;
  customBetCounts?: Record<string, number>;
  maxStake: number;
  defaultDirectionStake?: number | null;
  defaultScoreStake?: number | null;
}) {
  const t = useTranslations("dashboard");
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const timeZone = useSyncExternalStore(
    subscribeToHydration,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC"
  );
  const now = useSyncExternalStore(subscribeToNow, getNowSnapshot, () => 0);

  // Played matches stay in the list, so land the first paint on the next
  // game instead of making users scroll past everything already finished.
  const nextMatchId = matches.find((m) => m.status !== "final")?.id ?? null;
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current || !hydrated || !nextMatchId) return;
    if (matches[0]?.id === nextMatchId) return; // nothing played above it
    didScrollRef.current = true;
    document
      .getElementById(`match-card-${nextMatchId}`)
      ?.scrollIntoView({ block: "start" });
  }, [hydrated, nextMatchId, matches]);

  const renderMatchCards = (items: MatchCardMatch[]) => (
    <div className="space-y-2">
      {items.map((match) => (
        <div
          key={match.id}
          id={`match-card-${match.id}`}
          className="scroll-mt-[12.5rem] lg:scroll-mt-[6.5rem]"
        >
          <MatchCard
            match={match}
            roomCode={roomCode}
            myBet={myBets[match.id] ?? null}
            customBetCount={customBetCounts?.[match.id] ?? 0}
            maxStake={maxStake}
            now={now}
            defaultDirectionStake={defaultDirectionStake}
            defaultScoreStake={defaultScoreStake}
          />
        </div>
      ))}
    </div>
  );

  if (!hydrated) {
    return renderMatchCards(matches);
  }

  const matchGroups = groupMatchesByLocalDate(matches, {
    timeZone,
    now,
  });

  return (
    <div className="space-y-5">
      {matchGroups.map((group) => (
        <section key={group.dateKey} className="space-y-2">
          <div className="sticky top-[11rem] z-[5] -mx-4 flex items-center gap-3 bg-background px-4 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.04)] lg:top-[4.75rem] lg:mx-0 lg:px-0 lg:shadow-none">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-slate-700">
                <LocalDateTime
                  value={group.firstKickoff}
                  preset="dateWeekdayShort"
                />
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {t("matchCount", { count: group.matches.length })}
              </span>
              {group.showDeadline ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[11px] font-medium text-[#EA580C]">
                  <ClockIcon />
                  <span>{t("predictBefore")}</span>
                  <LocalDateTime value={group.firstKickoff} preset="time24" />
                </span>
              ) : null}
            </div>
            <div className="h-px min-w-6 flex-1 bg-[#dbe5f2]" aria-hidden="true" />
          </div>
          {renderMatchCards(group.matches)}
        </section>
      ))}
    </div>
  );
}
