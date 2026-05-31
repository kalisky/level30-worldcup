"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
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

// WC 2026 final: Sunday July 19, 2026 — buffer to 22:00 UTC after the final match.
const TOURNAMENT_END_MS = Date.UTC(2026, 6, 19, 22, 0);

// Group-stage matches finish ~2 hours after kickoff (90' + stoppage + halftime).
// If we later seed knockout matches that can go to extra time + penalties this
// constant should be expanded by ~1.5h for those rounds.
const MATCH_END_OFFSET_MS = 2 * 60 * 60 * 1000;

export default function ProposeBetModal({
  roomCode,
  matchId,
  matchLabel,
  matchKickoff,
}: {
  roomCode: string;
  matchId?: string;
  /** When `matchId` is set, the human-readable match label (e.g. "Mexico vs South Africa"). Shown in the modal so the user knows the bet is scoped to this match, not the whole room. */
  matchLabel?: string;
  /** ISO string of the match's kickoff time. Used to suggest "end of match" as a one-click lock time. */
  matchKickoff?: string;
}) {
  const t = useTranslations("customBet");
  const isMatchBet = Boolean(matchId);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"fixed_options" | "open_question">("fixed_options");
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
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const lockAtMs = lockAtLocal ? new Date(lockAtLocal).getTime() : NaN;
  const lockAtValid = Number.isFinite(lockAtMs);
  const lockAtIsPast = lockAtValid && lockAtMs <= now;
  const countdown = lockAtValid && !lockAtIsPast ? formatCountdown(lockAtMs, now) : null;

  // Per-scope suggestion for the "Use…" quick-set button. We only surface it
  // if the suggested time is still in the future.
  const suggestion = isMatchBet
    ? matchKickoff
      ? {
          label: "End of this match",
          atMs: new Date(matchKickoff).getTime() + MATCH_END_OFFSET_MS,
        }
      : null
    : { label: "End of tournament", atMs: TOURNAMENT_END_MS };
  const suggestionUsable = suggestion && suggestion.atMs > now;

  function applySuggestion() {
    if (!suggestion) return;
    setLockAtLocal(formatDateTimeLocal(new Date(suggestion.atMs)));
  }

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
    setKind("fixed_options");
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
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("locksAt", lockAtIso);
    if (kind === "fixed_options") {
      options.forEach((o) => fd.append("optionLabels", o));
    }
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
          setNow(Date.now());
          setOpen(true);
        }}
        className="w-full rounded-[24px] border-2 border-dashed border-[#cfdced] bg-[#F8FBFF] px-4 py-3 text-sm font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-white"
      >
        {isMatchBet
          ? `+ ${t("proposeMatch")}${matchLabel ? ` (${matchLabel})` : ""}`
          : `+ ${t("proposeRoom")}`}
      </button>
    );
  }

  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-4">
      <div className="my-auto w-full max-w-md rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)] max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-h-[calc(100vh-2rem)]">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-black text-[#1E3A8A]">
            {t("propose")}
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
              {t("matchBet")}{matchLabel ? <span className="normal-case tracking-normal"> — {matchLabel}</span> : null}
            </span>
          ) : (
            <span>{t("roomBet")}</span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              {t("betType")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("fixed_options")}
                className={
                  "rounded-2xl border-2 px-3 py-2.5 text-left text-sm transition " +
                  (kind === "fixed_options"
                    ? "border-[#1E3A8A] bg-[#EFF6FF]"
                    : "border-[#cdd9ea] bg-white hover:border-[#3B82F6]")
                }
              >
                <div className="font-bold text-[#1E3A8A]">{t("multipleChoice")}</div>
                <div className="text-xs text-slate-500">{t("multipleChoiceHint")}</div>
              </button>
              <button
                type="button"
                onClick={() => setKind("open_question")}
                className={
                  "rounded-2xl border-2 px-3 py-2.5 text-left text-sm transition " +
                  (kind === "open_question"
                    ? "border-[#1E3A8A] bg-[#EFF6FF]"
                    : "border-[#cdd9ea] bg-white hover:border-[#3B82F6]")
                }
              >
                <div className="font-bold text-[#1E3A8A]">{t("openQuestion")}</div>
                <div className="text-xs text-slate-500">{t("openQuestionHint")}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              {kind === "open_question" ? t("question") : t("title")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              dir="auto"
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              {t("description")} <span className="text-slate-400">{t("descriptionOptional")}</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              dir="auto"
              className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
              {t("lockTime")} <span className="text-[#EA580C]">*</span>
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
                {t("lockTimeHint")}
              </p>
            )}
            {suggestionUsable && (
              <button
                type="button"
                onClick={applySuggestion}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#cdd9ea] bg-white px-3 py-1.5 text-xs font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#EFF6FF]"
              >
                <span aria-hidden>📅</span>
                {t("useEnd")} {isMatchBet ? t("endOfMatch") : t("endOfTournament")}
              </button>
            )}
            {lockAtIsPast && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {t("lockTimePast")}
              </p>
            )}
            {countdown && (
              <p className="mt-2 rounded-xl bg-[#EFF6FF] px-3 py-2 text-sm font-bold text-[#1D4ED8]">
                {t("locksIn")} <span className="font-mono">{countdown}</span>
              </p>
            )}
          </div>
          {kind === "fixed_options" ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-[#1E3A8A]">
                {t("options")}
              </label>
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      maxLength={50}
                      dir="auto"
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
                  {t("addOption")}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#F8FBFF] px-3 py-3 text-xs text-slate-600">
              {t("openHint")}
            </p>
          )}
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
            (kind === "fixed_options" && options.some((o) => !o.trim()))
          }
          onClick={submit}
          className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? kind === "open_question"
              ? t("submitOpen")
              : t("submitPending")
            : t("submit")}
        </button>
      </div>
    </div>,
    portalTarget
  );
}
