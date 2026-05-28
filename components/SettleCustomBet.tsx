"use client";

import { useState, useTransition } from "react";
import type { CustomBet } from "@/lib/db/schema";
import {
  settleCustomBet,
  voidCustomBet,
  suggestCustomBetWinner,
} from "@/lib/actions/settle";

export default function SettleCustomBet({
  bet,
  roomCode,
  proposerName,
}: {
  bet: CustomBet;
  roomCode: string;
  proposerName: string;
}) {
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
    <article className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{bet.title}</h4>
        <span className="text-xs text-zinc-500">by {proposerName}</span>
      </header>
      {bet.description && (
        <p className="mt-0.5 text-xs text-zinc-500">{bet.description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {bet.options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={
              "rounded-lg border-2 px-2.5 py-1 text-xs transition " +
              (idx === i
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600")
            }
          >
            {o.label} <span className="font-mono text-zinc-500">{o.odds.toFixed(2)}x</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={idx === null || pending}
          onClick={submitSettle}
          className="rounded bg-zinc-900 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : "Mark winner"}
        </button>
        <button
          type="button"
          onClick={submitSuggest}
          disabled={pending}
          title="Use AI + web search to suggest the winner"
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Suggest with AI
        </button>
        <button
          type="button"
          onClick={submitVoid}
          disabled={pending}
          className="ml-auto rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Void & refund
        </button>
      </div>

      {info && (
        <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {info}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>
      )}
    </article>
  );
}
