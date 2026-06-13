"use client";

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

type LegType = "direction" | "score" | "custom";
type LegOutcome = "pending" | "won" | "lost" | "void";

export type HistoryBetLeg = {
  type: LegType;
  pick: string;
  stake: number;
  odds: number;
  outcome: LegOutcome;
  returned: number;
};

export type HistoryItem =
  | {
      kind: "bet";
      id: string;
      title: string;
      resultLine: string | null;
      legs: HistoryBetLeg[];
      totalStake: number;
      state: "open" | "won" | "lost" | "void";
      net: number | null;
      createdAt: string;
    }
  | {
      kind: "ledger";
      id: string;
      reason: string;
      delta: number;
      balanceAfter: number;
      subtitle: string | null;
      createdAt: string;
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

export default function HistoryEntries({ entries }: { entries: HistoryItem[] }) {
  const t = useTranslations("history");
  const tr = useTranslations("history.reason");
  const tb = useTranslations("bet");
  const tc = useTranslations("common");

  // Show settled bets and the non-bet ledger rows (grants, opening balance);
  // open bets are still in flight, so they live on the dashboard, not here.
  const filteredEntries = entries.filter(
    (entry) => entry.kind === "ledger" || entry.state !== "open"
  );
  const relativeStrings: RelativeStrings = {
    justNow: tc("justNow"),
    ago: tc("ago"),
  };

  function legLabel(type: LegType) {
    if (type === "direction") return tb("directionOutcome");
    if (type === "score") return tb("scoreOutcome");
    return tb("pick");
  }

  return (
    <>
      {filteredEntries.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          {entries.length === 0 ? t("noHistory") : t("noFilteredHistory")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredEntries.map((entry) => {
            const ts = new Date(entry.createdAt);
            const when = relativeOrAbsolute(ts, relativeStrings);

            if (entry.kind === "ledger") {
              const positive = entry.delta >= 0;
              const icon = REASON_ICONS[entry.reason] ?? "•";
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
                      <span className="font-bold text-[#1E3A8A]">{tr(entry.reason)}</span>
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
                      <span>{when}</span>
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
            }

            // Bet summary — card-style, one row per game / custom bet.
            const settled = entry.state === "won" || entry.state === "lost";
            return (
              <li
                key={entry.id}
                className="rounded-2xl border border-[#dbe5f2] bg-white p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-bold text-[#1E3A8A]">
                    {entry.title}
                  </span>
                  {entry.net != null ? (
                    <span
                      className={
                        "shrink-0 rounded-full px-2.5 py-0.5 font-mono text-sm font-black " +
                        (entry.net >= 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600")
                      }
                    >
                      {entry.net >= 0
                        ? tb("wonAmount", { amount: `+${entry.net}` })
                        : tb("lostAmount", { amount: entry.net })}
                    </span>
                  ) : entry.state === "void" ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                      {entry.resultLine}
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-xs font-bold text-[#1D4ED8]">
                      {entry.totalStake} {tc("chips")}
                    </span>
                  )}
                </div>

                {entry.resultLine && entry.state !== "void" && (
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {entry.resultLine}
                  </p>
                )}

                <div className="mt-2 space-y-1">
                  {entry.legs.map((leg, i) => {
                    const won = leg.outcome === "won";
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate text-slate-600">
                          <span className="font-semibold text-slate-500">
                            {legLabel(leg.type)}:
                          </span>{" "}
                          <span className="font-bold text-[#1E3A8A]">{leg.pick}</span> ·{" "}
                          {leg.stake} {tc("chips")}
                          {leg.odds > 0 && (
                            <span className="font-mono"> · {leg.odds.toFixed(2)}x</span>
                          )}
                        </span>
                        {settled && (
                          <span
                            className={
                              "shrink-0 font-mono font-bold " +
                              (won ? "text-emerald-600" : "text-red-500")
                            }
                          >
                            {won ? `✓ +${leg.returned}` : "✗ 0"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-1.5 text-xs text-slate-400">{when}</div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
