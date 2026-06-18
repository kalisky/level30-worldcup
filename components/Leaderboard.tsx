"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RoomLeaderboardEntry } from "@/lib/db/queries";

const podiumStyles = [
  "border-l-4 border-[#EAB308] bg-[#FFF9DB]",
  "border-l-4 border-slate-400 bg-slate-100",
  "border-l-4 border-[#C2410C] bg-[#FFF1E8]",
];

// I'm currently showing only "includingOpenBets" mode, but keeping the code for "availableOnly" mode in case we want to bring it back in the future.
type LeaderboardMode = "includingOpenBets" | "availableOnly";

export default function Leaderboard({
  users,
  meId,
  roomCode,
}: {
  users: RoomLeaderboardEntry[];
  meId: string;
  roomCode: string;
}) {
  const t = useTranslations("dashboard");
  const tnav = useTranslations("nav");
  const tc = useTranslations("common");
  const mode: LeaderboardMode = "includingOpenBets";
  const sortedUsers = [...users].sort((a, b) => {
    const displayedDiff =
      (mode === "includingOpenBets"
        ? b.chipsIncludingOpenBets
        : b.availableChips) -
      (mode === "includingOpenBets"
        ? a.chipsIncludingOpenBets
        : a.availableChips);
    if (displayedDiff !== 0) return displayedDiff;
    const totalDiff = b.chipsIncludingOpenBets - a.chipsIncludingOpenBets;
    if (totalDiff !== 0) return totalDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
          {t("leaderboard")}
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/r/${roomCode}/stats`}
            className="text-xs font-bold uppercase tracking-[0.16em] text-[#1D4ED8] hover:underline"
          >
            {tnav("stats")}
          </Link>
          <Link
            href={`/r/${roomCode}/history`}
            className="text-xs font-bold uppercase tracking-[0.16em] text-[#1D4ED8] hover:underline"
          >
            {t("myHistory")}
          </Link>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-3">
        {/* <div className="inline-flex w-full rounded-full border border-[#dbe5f2] bg-[#F8FBFF] p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("includingOpenBets")}
            className={
              "flex-1 rounded-full px-3 py-2 text-sm font-bold transition sm:flex-none " +
              (mode === "includingOpenBets"
                ? "bg-[#1E3A8A] text-white shadow-[0_10px_24px_rgba(30,58,138,0.18)]"
                : "text-slate-600 hover:text-[#1E3A8A]")
            }
          >
            {t("leaderboardModeAll")}
          </button>
          <button
            type="button"
            onClick={() => setMode("availableOnly")}
            className={
              "flex-1 rounded-full px-3 py-2 text-sm font-bold transition sm:flex-none " +
              (mode === "availableOnly"
                ? "bg-[#1E3A8A] text-white shadow-[0_10px_24px_rgba(30,58,138,0.18)]"
                : "text-slate-600 hover:text-[#1E3A8A]")
            }
          >
            {t("leaderboardModeAvailable")}
          </button>
        </div> */}
        <p className="text-sm text-slate-500">
          {mode === "includingOpenBets"
            ? t("leaderboardModeAllHint")
            : t("leaderboardModeAvailableHint")}
        </p>
      </div>
      <ol className="space-y-2">
        {sortedUsers.map((u, i) => (
          <Link
            key={u.id}
            href={`/r/${roomCode}/history${u.id === meId ? "" : `?user=${u.id}`}`}
            className={
              "flex items-center justify-between rounded-[22px] border px-4 py-3 transition hover:-translate-y-0.5 " +
              (u.id === meId
                ? "border-[#BFDBFE] bg-[#EFF6FF] shadow-[0_10px_24px_rgba(59,130,246,0.12)]"
                : i < 3
                  ? `border-transparent ${podiumStyles[i]}`
                  : "border-[#e4edf7] bg-[#F8FBFF]"
              )
            }
          >
            <span className="flex items-center gap-3">
              <span
                className={
                  "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-black " +
                  (i === 0
                    ? "bg-[#FDE68A] text-[#92400E]"
                    : i === 1
                      ? "bg-slate-200 text-slate-700"
                      : i === 2
                        ? "bg-[#FED7AA] text-[#9A3412]"
                        : u.id === meId
                          ? "bg-[#DBEAFE] text-[#1D4ED8]"
                          : "bg-white text-slate-500 ring-1 ring-[#dbe5f2]")
                }
              >
                {i < 3 ? ["1", "2", "3"][i] : i + 1}
              </span>
              <span>
                <span className="block text-base font-bold text-[#1E3A8A]">
                  {u.name}
                </span>
                {u.id === meId && (
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">
                    {tc("you")}
                  </span>
                )}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-xl font-black text-[#1E3A8A]">
                {mode === "includingOpenBets"
                  ? u.chipsIncludingOpenBets
                  : u.availableChips}
              </span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {tc("chips")}
              </span>
              {u.openBetChips > 0 && (
                <span className="mt-1 block text-[0.76rem] font-medium text-slate-500">
                  {t("leaderboardUnsettledBets", { amount: u.openBetChips })}
                </span>
              )}
            </span>
          </Link>
        ))}
      </ol>
    </section>
  );
}
