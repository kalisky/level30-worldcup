"use client";

import { useEffect, useState, useTransition } from "react";
import { proposeCustomBet } from "@/lib/actions/custom-bets";

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoFromLocalDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatCountdown(targetMs: number, nowMs: number) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export default function ProposeBetModal({
  roomCode,
  matchId,
  matchLabel,
}: {
  roomCode: string;
  matchId?: string;
  /** When `matchId` is set, the human-readable match label (e.g. "Mexico vs South Africa"). Shown in the modal so the user knows the bet is scoped to this match, not the whole room. */
  matchLabel?: string;
}) {
  const isMatchBet = Boolean(matchId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [lockAtLocal, setLockAtLocal] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Tick once a minute while the modal is open so the countdown stays live.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const lockAtMs = lockAtLocal ? new Date(lockAtLocal).getTime() : NaN;
  const lockAtValid = Number.isFinite(lockAtMs);
  const lockAtIsPast = lockAtValid && lockAtMs <= now;
  const countdown = lockAtValid && !lockAtIsPast ? formatCountdown(lockAtMs, now) : null;

  function setOption(idx: number, value: string) {
    setOptions((o) => o.map((v, i) => (i === idx ? value : v)));
  }
  function addOption() {
    if (options.length < 5) setOptions([...options, ""]);
  }
  function removeOption(idx: number) {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setOptions(["Yes", "No"]);
    setLockAtLocal("");
    setError(null);
  }

  function submit() {
    setError(null);
    const lockAtIso = toIsoFromLocalDateTime(lockAtLocal);
    if (!lockAtIso) {
      setError("Pick a valid lock time.");
      return;
    }

    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("locksAt", lockAtIso);
    options.forEach((o) => fd.append("optionLabels", o));
    startTransition(async () => {
      try {
        await proposeCustomBet(fd);
        setOpen(false);
        resetForm();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to propose bet.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="w-full rounded-[24px] border-2 border-dashed border-[#cfdced] bg-[#F8FBFF] px-4 py-3 text-sm font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-white"
      >
        {isMatchBet
          ? `+ Propose a bet on this match${matchLabel ? ` (${matchLabel})` : ""}`
          : "+ Propose a room-wide bet"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-black text-[#1E3A8A]">
            Propose a custom bet
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-500 transition hover:text-[#1E3A8A]"
          >
            ✕
          </button>
        </div>

        <div
          className={
            "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] " +
            (isMatchBet
              ? "bg-[#FFF1E8] text-[#EA580C]"
              : "bg-[#E0EEFF] text-[#1D4ED8]")
          }
        >
          <span aria-hidden>{isMatchBet ? "⚽" : "🌐"}</span>
          {isMatchBet ? (
            <span>
              Match bet{matchLabel ? <span className="normal-case tracking-normal"> — {matchLabel}</span> : null}
            </span>
          ) : (
            <span>Room-wide bet</span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isMatchBet
            ? "Wagering on this bet only counts for this specific match. AI will generate odds when you submit."
            : "This bet applies to the whole room, not a specific match (e.g., \"Brazil wins the World Cup\"). AI will generate odds when you submit."}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Will France score in the first half?"
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Clarify the line if needed."
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Lock time <span className="text-[#EA580C]">*</span>
            </label>
            <input
              type="datetime-local"
              value={lockAtLocal}
              onChange={(e) => setLockAtLocal(e.target.value)}
              min={formatDateTimeLocal(new Date())}
              required
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
            {!lockAtLocal && (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Pick when wagering should close — must set explicitly.
              </p>
            )}
            {lockAtIsPast && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                ⚠️ Lock time is in the past — pick a later moment.
              </p>
            )}
            {countdown && (
              <p className="mt-2 rounded-xl bg-[#EFF6FF] px-3 py-2 text-sm font-bold text-[#1D4ED8]">
                🔒 Locks in <span className="font-mono">{countdown}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              Options
            </label>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={50}
                    className="flex-1 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="rounded-2xl border border-[#cdd9ea] px-3 text-slate-500 transition hover:border-[#3B82F6] hover:bg-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 5 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-[#1E3A8A]"
              >
                + Add option
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={
            pending ||
            title.trim().length < 3 ||
            !lockAtValid ||
            lockAtIsPast ||
            options.some((o) => !o.trim())
          }
          onClick={submit}
          className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "AI is rating this…" : "Propose bet"}
        </button>
      </div>
    </div>
  );
}
