"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import LocalDateTime from "@/components/LocalDateTime";

const REASON_ICONS: Record<string, string> = {
  opening_balance: "📜",
  initial: "🎟️",
  daily_grant: "🎁",
  match_bet_placed: "⚽",
  match_bet_payout: "🏆",
  custom_wager_placed: "🎲",
  custom_wager_payout: "🏆",
  custom_wager_refund: "↩️",
  custom_wager_canceled: "↩️",
  match_bet_refund: "↩️",
};

type HistoryEntryState = "neutral" | "open" | "won" | "lost";
type HistoryFilterMode = "all" | "settledOnly" | "winsOnly";

export type HistoryEntryItem = {
  id: string;
  reason: string;
  delta: number;
  balanceAfter: number;
  createdAt: string;
  subtitle: string | null;
  state: HistoryEntryState;
};

type RelativeStrings = {
  justNow: string;
  ago: string;
};

function relativeOrAbsolute(d: Date, s: RelativeStrings) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return s.justNow;
  if (m < 60) return `${m}m ${s.ago}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${s.ago}`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ${s.ago}`;
  return <LocalDateTime value={d} preset="lockShort" />;
}

function matchesFilter(entry: HistoryEntryItem, mode: HistoryFilterMode) {
  console.log({ entry, mode });
  if (mode === "all") return true;
  if (mode === "settledOnly") return entry.state !== "open";
  return entry?.delta > 0 && entry.state !== "open";
}

export default function HistoryEntries({
  entries,
}: {
  entries: HistoryEntryItem[];
}) {
  const t = useTranslations("history");
  const tr = useTranslations("history.reason");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<HistoryFilterMode>("settledOnly");

  const filteredEntries = entries.filter((entry) => matchesFilter(entry, mode));
  const relativeStrings: RelativeStrings = {
    justNow: tc("justNow"),
    ago: tc("ago"),
  };

  return (
    <>
      <section className="rounded-[22px] border border-[#dbe5f2] bg-white p-4 shadow-[0_12px_30px_rgba(30,58,138,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", "filterAllBets"],
            ["settledOnly", "filterSettledOnly"],
            ["winsOnly", "filterWinsOnly"],
          ] as const).map(([value, labelKey]) => {
            const active = mode === value;
            return (
              <label
                key={value}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition " +
                  (active
                    ? "border-[#BFDBFE] bg-[#EFF6FF]"
                    : "border-[#dbe5f2] bg-white hover:bg-[#F8FBFF]")
                }
              >
                <input
                  type="radio"
                  name="history-filter"
                  checked={active}
                  onChange={() => setMode(value)}
                  className="h-4 w-4 rounded border-[#94A3B8] text-[#1D4ED8] focus:ring-[#93C5FD]"
                />
                <span className="font-semibold text-[#1E3A8A]">
                  {t(labelKey)}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {filteredEntries.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          {entries.length === 0 ? t("noHistory") : t("noFilteredHistory")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredEntries.map((entry) => {
            const positive = entry.delta >= 0;
            const icon = REASON_ICONS[entry.reason] ?? "•";
            const ts = new Date(entry.createdAt);

            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-2xl border border-[#dbe5f2] bg-white p-4"
              >
                <span className="text-2xl" aria-hidden>
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[#1E3A8A]">
                      {tr(entry.reason)}
                    </span>
                    <span
                      className={
                        "font-mono text-lg font-black " +
                        (positive ? "text-emerald-600" : "text-rose-600")
                      }
                    >
                      {positive ? "+" : ""}
                      {entry.delta}
                    </span>
                  </div>
                  {entry.subtitle && (
                    <p className="mt-0.5 truncate text-sm text-slate-600 whitespace-break-spaces">
                      {entry.subtitle}
                    </p>
                  )}
                  <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-slate-500">
                    <span>{relativeOrAbsolute(ts, relativeStrings)}</span>
                    <span>
                      {t("balance")}{" "}
                      <span className="font-mono font-semibold text-[#1E3A8A]">
                        {entry.balanceAfter}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
