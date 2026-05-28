"use client";

import { useState, useTransition } from "react";
import type { CustomBet, CustomWager } from "@/lib/db/schema";
import { placeCustomWager } from "@/lib/actions/custom-bets";

export default function CustomBetCard({
  bet,
  proposerName,
  roomCode,
  matchId,
  myWager,
  myChips,
  wagers,
}: {
  bet: CustomBet;
  proposerName: string;
  roomCode: string;
  matchId?: string;
  myWager: CustomWager | null;
  myChips: number;
  wagers: { wager: CustomWager; userName: string }[];
}) {
  const [optionIdx, setOptionIdx] = useState<number | null>(null);
  const [stake, setStake] = useState<number>(25);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLocked =
    bet.status !== "open" ||
    (bet.locksAt ? new Date(bet.locksAt).getTime() <= Date.now() : false);

  function submit() {
    if (optionIdx === null) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("customBetId", bet.id);
    fd.set("optionIdx", String(optionIdx));
    fd.set("stake", String(stake));
    startTransition(async () => {
      try {
        await placeCustomWager(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to wager.");
      }
    });
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{bet.title}</h3>
        <span className="text-xs text-zinc-500">by {proposerName}</span>
      </header>
      {bet.description && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{bet.description}</p>
      )}
      {bet.aiReasoning && (
        <p className="mt-1 text-xs italic text-zinc-500">
          AI: {bet.aiReasoning}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {bet.options.map((o, i) => {
          const selected = optionIdx === i;
          const isMyPick = myWager?.optionIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => !myWager && !isLocked && setOptionIdx(i)}
              disabled={!!myWager || isLocked}
              className={
                "rounded-lg border-2 px-3 py-2 text-left transition disabled:cursor-default " +
                (selected
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30"
                  : isMyPick
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                    : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600")
              }
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div className="font-mono text-xs text-zinc-500">{o.odds.toFixed(2)}x</div>
            </button>
          );
        })}
      </div>

      {myWager ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          You wagered {myWager.stake} chips on{" "}
          <span className="font-semibold">{bet.options[myWager.optionIdx]?.label}</span>{" "}
          @ {Number(myWager.oddsLocked).toFixed(2)}x.{" "}
          <span className="text-zinc-500">
            (payout {Math.floor(myWager.stake * Number(myWager.oddsLocked))})
          </span>
        </p>
      ) : isLocked ? (
        <p className="mt-3 text-sm text-zinc-500">Locked.</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={myChips}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-right font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-xs text-zinc-500">/ {myChips}</span>
          <button
            type="button"
            disabled={optionIdx === null || stake < 1 || stake > myChips || pending}
            onClick={submit}
            className="ml-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {pending ? "Wagering…" : "Wager"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      )}

      {wagers.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-500">
            {wagers.length} {wagers.length === 1 ? "wager" : "wagers"} placed
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {wagers.map(({ wager, userName }) => (
              <li key={wager.id} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{userName}</span>{" "}
                  <span className="text-zinc-500">→</span>{" "}
                  {bet.options[wager.optionIdx]?.label}
                </span>
                <span className="font-mono text-zinc-500">
                  {wager.stake} @ {Number(wager.oddsLocked).toFixed(2)}x
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
