"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { CustomBet, CustomWager } from "@/lib/db/schema";
import { placeCustomWager } from "@/lib/actions/custom-bets";

function formatLockTime(value: Date | string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CustomBetCard({
  bet,
  proposerName,
  roomCode,
  matchId,
  contextLabel,
  contextHref,
  highlighted,
  myWager,
  myChips,
  wagers,
}: {
  bet: CustomBet;
  proposerName: string;
  roomCode: string;
  matchId?: string;
  contextLabel?: string | null;
  contextHref?: string | null;
  highlighted?: boolean;
  myWager: CustomWager | null;
  myChips: number;
  wagers: { wager: CustomWager; userName: string }[];
}) {
  const [optionIdx, setOptionIdx] = useState<number | null>(null);
  const [stake, setStake] = useState<number>(25);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [now] = useState(() => Date.now());

  const isLocked =
    bet.status !== "open" ||
    (bet.locksAt ? new Date(bet.locksAt).getTime() <= now : false);
  const sharePath = matchId
    ? `/r/${roomCode}/match/${matchId}?bet=${bet.id}#custom-bet-${bet.id}`
    : `/r/${roomCode}/dashboard?bet=${bet.id}#custom-bet-${bet.id}`;

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

  async function copyShareLink() {
    const shareUrl = new URL(sharePath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("failed");
      window.setTimeout(() => setShareState("idle"), 2500);
    }
  }

  return (
    <article
      id={`custom-bet-${bet.id}`}
      className={
        "scroll-mt-28 rounded-[26px] border bg-white p-5 shadow-[0_14px_32px_rgba(30,58,138,0.07)] transition " +
        (highlighted
          ? "border-[#3B82F6] ring-2 ring-[#BFDBFE]"
          : "border-[#dbe5f2]")
      }
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-black text-[#1E3A8A]">{bet.title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-full border border-[#cdd9ea] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            {shareState === "copied"
              ? "Copied"
              : shareState === "failed"
                ? "Copy failed"
                : "Share"}
          </button>
          <span className="pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            by {proposerName}
          </span>
        </div>
      </header>
      {contextHref && contextLabel ? (
        <Link
          href={contextHref}
          className="mt-2 inline-flex rounded-full bg-[#EFF6FF] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#1D4ED8] transition hover:bg-[#E0EEFF]"
        >
          {contextLabel}
        </Link>
      ) : contextLabel ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {contextLabel}
        </p>
      ) : null}
      {bet.description && (
        <p className="mt-1 text-sm leading-6 text-slate-600">{bet.description}</p>
      )}
      {bet.aiReasoning && (
        <p className="mt-2 rounded-2xl bg-[#F8FBFF] px-3 py-2 text-xs italic text-slate-500 ring-1 ring-[#dbe5f2]">
          AI: {bet.aiReasoning}
        </p>
      )}
      {bet.locksAt && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {isLocked ? "Locked" : "Locks"} {formatLockTime(bet.locksAt)}
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
                "rounded-[20px] border-2 px-3 py-2 text-left transition disabled:cursor-default " +
                (selected
                  ? "border-[#3B82F6] bg-[#E0EEFF]"
                  : isMyPick
                    ? "border-[#F97316] bg-[#FFF1E8]"
                    : "border-[#dbe5f2] bg-white hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
              }
            >
              <div className="text-sm font-bold text-[#1E3A8A]">{o.label}</div>
              <div className="font-mono text-xs font-semibold text-slate-500">{o.odds.toFixed(2)}x</div>
            </button>
          );
        })}
      </div>

      {myWager ? (
        <p className="mt-4 rounded-2xl bg-[#FFF1E8] px-4 py-3 text-sm text-[#C2410C]">
          You wagered {myWager.stake} chips on{" "}
          <span className="font-bold">{bet.options[myWager.optionIdx]?.label}</span>{" "}
          @ {Number(myWager.oddsLocked).toFixed(2)}x.{" "}
          <span className="text-slate-500">
            (payout {Math.floor(myWager.stake * Number(myWager.oddsLocked))})
          </span>
        </p>
      ) : isLocked ? (
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Locked
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={myChips}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-20 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono text-sm font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            / {myChips}
          </span>
          <button
            type="button"
            disabled={optionIdx === null || stake < 1 || stake > myChips || pending}
            onClick={submit}
            className="ml-auto rounded-[20px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Wagering…" : "Wager"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {wagers.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {wagers.length} {wagers.length === 1 ? "wager" : "wagers"} placed
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {wagers.map(({ wager, userName }) => (
              <li key={wager.id} className="flex items-center justify-between">
                <span>
                  <span className="font-semibold text-[#1E3A8A]">{userName}</span>{" "}
                  <span className="text-slate-500">→</span>{" "}
                  {bet.options[wager.optionIdx]?.label}
                </span>
                <span className="font-mono font-semibold text-slate-500">
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
