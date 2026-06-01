"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { CustomBet } from "@/lib/db/schema";
import {
  settleCustomBet,
  voidCustomBet,
  suggestCustomBetWinner,
} from "@/lib/actions/settle";
import { customBetCopy } from "@/lib/custom-bet-copy";

export default function SettleCustomBet({
  bet,
  roomCode,
  proposerName,
  wagererCount,
}: {
  bet: CustomBet;
  roomCode: string;
  proposerName: string;
  /** Distinct number of users who've wagered. Below 2 the bet is invalid and
   *  can only be voided. */
  wagererCount: number;
}) {
  const t = useTranslations("admin");
  const tDefaults = useTranslations("customBet.defaults");
  const copy = customBetCopy(bet, tDefaults);
  const hasEnoughWagerers = wagererCount >= 2;
  const wagererLabel =
    wagererCount === 1 ? t("wagerer", { count: wagererCount }) : t("wagerers", { count: wagererCount });
  const [idx, setIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function submitSettle() {
    if (idx === null) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("customBetId", bet.id);
    fd.set("winningOptionIdx", String(idx));
    if (bet.matchId) fd.set("matchId", bet.matchId);
    startTransition(async () => {
      try {
        await settleCustomBet(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function submitVoid() {
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("customBetId", bet.id);
    startTransition(async () => {
      try {
        await voidCustomBet(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function submitSuggest() {
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    fd.set("customBetId", bet.id);
    startTransition(async () => {
      try {
        const result = await suggestCustomBetWinner(fd);
        if (result.determinable && result.winningOptionIdx != null) {
          setIdx(result.winningOptionIdx);
          setInfo(
            `AI suggests "${bet.options[result.winningOptionIdx]?.label}". ${result.reasoning}`
          );
        } else {
          setError(`AI couldn't decide. ${result.reasoning}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Suggest failed.");
      }
    });
  }

  return (
    <article className="rounded-[26px] border border-[#dbe5f2] bg-white p-4 shadow-[0_14px_32px_rgba(30,58,138,0.07)]">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-black text-[#1E3A8A]">{copy.title}</h4>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {proposerName}
        </span>
      </header>
      {copy.description && (
        <p className="mt-1 text-xs leading-6 text-slate-500">{copy.description}</p>
      )}
      <div
        className={
          "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] " +
          (hasEnoughWagerers
            ? "bg-[#E0F2FE] text-[#0369A1]"
            : "bg-[#FEF3C7] text-[#92400E]")
        }
      >
        {wagererLabel}
        {!hasEnoughWagerers && ` · ${t("needsTwo")}`}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {bet.options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={
              "rounded-[18px] border-2 px-3 py-2 text-xs transition " +
              (idx === i
                ? "border-[#3B82F6] bg-[#E0EEFF]"
                : "border-[#dbe5f2] hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
            }
          >
            {o.label}{" "}
            <span className="font-mono font-semibold text-slate-500">{o.odds.toFixed(2)}x</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={idx === null || pending || !hasEnoughWagerers}
          onClick={submitSettle}
          title={
            hasEnoughWagerers
              ? undefined
              : "Need at least 2 different wagerers before this can be settled"
          }
          className="rounded-full bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)] disabled:opacity-50"
        >
          {pending ? "…" : t("markWinner")}
        </button>
        <button
          type="button"
          onClick={submitSuggest}
          disabled={pending || !hasEnoughWagerers}
          className="rounded-full border border-[#cdd9ea] px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
        >
          {t("suggestWithAi")}
        </button>
        <button
          type="button"
          onClick={submitVoid}
          disabled={pending}
          className="ml-auto rounded-full border border-[#cdd9ea] px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:opacity-50"
        >
          {t("voidAndRefund")}
        </button>
      </div>

      {!hasEnoughWagerers && (
        <p className="mt-2 rounded-2xl bg-[#FEF3C7] px-3 py-2 text-xs font-medium text-[#92400E]">
          {t("needsTwoWarning", { count: wagererCount, label: wagererLabel })}
        </p>
      )}

      {info && (
        <p className="mt-2 rounded-2xl bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#1D4ED8]">
          {info}
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
