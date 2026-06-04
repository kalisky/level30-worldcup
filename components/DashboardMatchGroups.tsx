"use client";

import { useSyncExternalStore } from "react";
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
  maxStake,
}: {
  matches: MatchCardMatch[];
  roomCode: string;
  myBets: Record<string, DashboardQuickBetExisting | null | undefined>;
  maxStake: number;
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

  const renderMatchCards = (items: MatchCardMatch[]) => (
    <div className="space-y-2">
      {items.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          roomCode={roomCode}
          myBet={myBets[match.id] ?? null}
          maxStake={maxStake}
          now={now}
        />
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
          <div className="flex items-center gap-3">
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
