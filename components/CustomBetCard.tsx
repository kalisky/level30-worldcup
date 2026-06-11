"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { CustomBet, CustomWager } from "@/lib/db/schema";
import {
  placeCustomWager,
  placeOpenWager,
  previewOpenAnswerOdds,
  removeCustomWager,
  updateCustomBetLockTime,
  updateCustomWager,
  updateOpenWager,
} from "@/lib/actions/custom-bets";
import { getCustomBetInvitePath } from "@/lib/share-links";
import { customBetCopy } from "@/lib/custom-bet-copy";
import LocalDateTime from "@/components/LocalDateTime";

function formatDateTimeLocal(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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

export default function CustomBetCard({
  bet,
  proposerName,
  viewerUserId,
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
  viewerUserId: string;
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
  const [removing, startRemove] = useTransition();
  const [lockTimePending, startLockTimeTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lockTimeError, setLockTimeError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const [now] = useState(() => Date.now());
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingLockTime, setIsEditingLockTime] = useState(false);
  const [lockEditNow, setLockEditNow] = useState(() => Date.now());
  const [lockAtLocal, setLockAtLocal] = useState("");

  const t = useTranslations("customBet");
  const tc = useTranslations("common");
  const tDefaults = useTranslations("customBet.defaults");
  const copy = customBetCopy(bet, tDefaults);

  // Open-question state
  const [answer, setAnswer] = useState("");
  const [preview, setPreview] = useState<{
    label: string;
    odds: number;
    reasoning: string;
    isExisting: boolean;
  } | null>(null);
  const [previewing, startPreview] = useTransition();
  const isOpenQuestion = bet.kind === "open_question";

  const isLocked =
    bet.status !== "open" ||
    (bet.locksAt ? new Date(bet.locksAt).getTime() <= now : false);
  const canEditLockTime =
    viewerUserId === bet.proposerId && bet.status === "open";
  const editedLockAtMs = lockAtLocal ? new Date(lockAtLocal).getTime() : NaN;
  const editedLockAtIsPast =
    Number.isFinite(editedLockAtMs) && editedLockAtMs <= lockEditNow;
  // While editing, the rest of the render treats the user as not-yet-wagered
  // so the picker / wager controls re-appear pre-filled.
  const wagerView = isEditing ? null : myWager;
  const canEditWager = !!myWager && !isLocked && myWager.status === "open";
  const stakeMax =
    isEditing && myWager ? myChips + myWager.stake : myChips;
  const sharePath = getCustomBetInvitePath({
    roomCode,
    betId: bet.id,
    matchId,
  });

  function submit() {
    if (optionIdx === null) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("customBetId", bet.id);
    fd.set("optionIdx", String(optionIdx));
    fd.set("stake", String(stake));
    const action = isEditing ? updateCustomWager : placeCustomWager;
    startTransition(async () => {
      try {
        await action(fd);
        setIsEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to wager.");
      }
    });
  }

  function startEdit() {
    if (!myWager) return;
    setOptionIdx(myWager.optionIdx);
    setStake(myWager.stake);
    if (isOpenQuestion) {
      const opt = bet.options[myWager.optionIdx];
      if (opt) {
        setAnswer(opt.label);
        setPreview({
          label: opt.label,
          odds: opt.odds,
          reasoning: "Cached odds — your prior pick.",
          isExisting: true,
        });
      }
    }
    setError(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setError(null);
    setOptionIdx(null);
    if (isOpenQuestion) {
      setAnswer("");
      setPreview(null);
    }
  }

  function startLockTimeEdit() {
    setLockEditNow(Date.now());
    setLockAtLocal(bet.locksAt ? formatDateTimeLocal(bet.locksAt) : "");
    setLockTimeError(null);
    setIsEditingLockTime(true);
  }

  function cancelLockTimeEdit() {
    setIsEditingLockTime(false);
    setLockAtLocal("");
    setLockTimeError(null);
  }

  function submitLockTimeUpdate() {
    const lockAtIso = toIsoFromLocalDateTime(lockAtLocal);
    if (!lockAtIso) {
      setLockTimeError("Pick a valid lock time.");
      return;
    }
    if (new Date(lockAtIso).getTime() <= Date.now()) {
      setLockTimeError("Lock time must be in the future.");
      return;
    }

    setLockTimeError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("customBetId", bet.id);
    fd.set("locksAt", lockAtIso);
    startLockTimeTransition(async () => {
      try {
        await updateCustomBetLockTime(fd);
        cancelLockTimeEdit();
      } catch (e) {
        setLockTimeError(
          e instanceof Error ? e.message : "Failed to update lock time."
        );
      }
    });
  }

  function submitRemove() {
    if (!myWager) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("customBetId", bet.id);
    startRemove(async () => {
      try {
        await removeCustomWager(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove wager.");
      }
    });
  }

  function checkOdds() {
    if (!answer.trim()) return;
    setError(null);
    setPreview(null);
    startPreview(async () => {
      try {
        const r = await previewOpenAnswerOdds({
          roomCode,
          customBetId: bet.id,
          answer: answer.trim(),
        });
        setPreview({
          label: r.label,
          odds: r.odds,
          reasoning: r.reasoning,
          isExisting: r.isExisting,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't compute odds.");
      }
    });
  }

  function selectExistingAnswer(label: string, odds: number) {
    setAnswer(label);
    setPreview({
      label,
      odds,
      reasoning: "Cached odds — already submitted by another player.",
      isExisting: true,
    });
  }

  function submitOpen() {
    if (!answer.trim() || !preview) return;
    setError(null);
    const fd = new FormData();
    fd.set("roomCode", roomCode);
    if (matchId) fd.set("matchId", matchId);
    fd.set("customBetId", bet.id);
    fd.set("answer", answer.trim());
    fd.set("stake", String(stake));
    const action = isEditing ? updateOpenWager : placeOpenWager;
    startTransition(async () => {
      try {
        await action(fd);
        setIsEditing(false);
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

  const shareLabel =
    shareState === "copied"
      ? tc("copied")
      : shareState === "failed"
        ? tc("copyFailed")
        : tc("share");

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
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.72rem] font-medium text-slate-400">
          <span>{t("byAuthor", { name: proposerName })}</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {bet.locksAt ? (
              <span>
                {t("closes")}{" "}
                <LocalDateTime value={bet.locksAt!} preset="lockShort" />
              </span>
            ) : null}
            {canEditLockTime && !isEditingLockTime ? (
              <button
                type="button"
                onClick={startLockTimeEdit}
                className="rounded-full border border-[#dbe5f2] bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF]"
              >
                {t("editLockTime")}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-lg font-black text-[#1E3A8A]">
            {copy.title}
          </h3>
          <button
            type="button"
            onClick={copyShareLink}
            aria-label={shareLabel}
            title={shareLabel}
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition " +
              (shareState === "copied"
                ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                : shareState === "failed"
                  ? "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]"
                  : "border-[#cdd9ea] text-slate-500 hover:border-[#3B82F6] hover:bg-[#F8FBFF] hover:text-[#1E3A8A]")
            }
          >
            {shareState === "copied" ? (
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m4.5 10 3.2 3.2L15.5 5.5" />
              </svg>
            ) : shareState === "failed" ? (
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 6v4" />
                <path d="M10 13h.01" />
                <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 12V3.5" />
                <path d="m6.5 7 3.5-3.5L13.5 7" />
                <path d="M5 11.5v3A1.5 1.5 0 0 0 6.5 16h7a1.5 1.5 0 0 0 1.5-1.5v-3" />
              </svg>
            )}
          </button>
        </div>
        {isEditingLockTime ? (
          <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] p-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("lockTime")}
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={lockAtLocal}
                onChange={(e) => setLockAtLocal(e.target.value)}
                className="min-w-[14rem] flex-1 rounded-2xl border border-[#cdd9ea] bg-white px-3 py-2 text-sm text-[#1E3A8A] focus:border-[#3B82F6] focus:outline-none"
              />
              <button
                type="button"
                onClick={cancelLockTimeEdit}
                disabled={lockTimePending}
                className="rounded-full border border-[#cdd9ea] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={submitLockTimeUpdate}
                disabled={!lockAtLocal || editedLockAtIsPast || lockTimePending}
                className="rounded-full bg-[#1E3A8A] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lockTimePending ? tc("saving") : tc("save")}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t("lockTimeHint")}</p>
            {editedLockAtIsPast ? (
              <p className="mt-2 text-xs font-semibold text-[#C2410C]">
                {t("lockTimePast")}
              </p>
            ) : null}
            {lockTimeError ? (
              <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {lockTimeError}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>
      {contextHref && contextLabel ? (
        <Link
          href={contextHref}
          className="mt-2 inline-flex rounded-full bg-[#EFF6FF] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#1D4ED8] transition hover:bg-[#E0EEFF]"
        >
          {contextLabel}
        </Link>
      ) : null}
      {copy.description && (
        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.description}</p>
      )}
      {bet.aiReasoning && (
        <p className="mt-2 rounded-2xl bg-[#F8FBFF] px-3 py-2 text-xs italic text-slate-500 ring-1 ring-[#dbe5f2]">
          AI: {bet.aiReasoning}
        </p>
      )}

      {isOpenQuestion ? (
        <div className="mt-3 space-y-3">
          {bet.options.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("answersSoFar")}
              </p>
              <div className="flex flex-wrap gap-2">
                {bet.options.map((o, i) => {
                  const isMyPick = myWager?.optionIdx === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        !wagerView && !isLocked && selectExistingAnswer(o.label, o.odds)
                      }
                      disabled={!!wagerView || isLocked}
                      className={
                        "rounded-[20px] border-2 px-3 py-2 text-left transition disabled:cursor-default " +
                        (isMyPick
                          ? "border-[#F97316] bg-[#FFF1E8]"
                          : answer.trim().toLowerCase() === o.label.toLowerCase()
                            ? "border-[#3B82F6] bg-[#E0EEFF]"
                            : "border-[#dbe5f2] bg-white hover:border-[#3B82F6] hover:bg-[#F8FBFF]")
                      }
                    >
                      <div className="text-sm font-bold text-[#1E3A8A]">{o.label}</div>
                      <div className="font-mono text-xs font-semibold text-slate-500">
                        {o.odds.toFixed(2)}x
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {t("noAnswers")}
            </p>
          )}

          {!wagerView && !isLocked && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("yourAnswer")}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="auto"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setPreview(null);
                  }}
                  maxLength={80}
                  placeholder={copy.placeholder ?? t("answerPlaceholder")}
                  className="flex-1 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!answer.trim() || previewing}
                  onClick={checkOdds}
                  className="rounded-2xl border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm font-bold text-[#1D4ED8] transition hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewing ? t("checking") : t("checkOdds")}
                </button>
              </div>

              {preview && (
                <div className="mt-2 rounded-2xl bg-[#EFF6FF] px-3 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-[#1E3A8A]">
                      {preview.label}{" "}
                      <span className="font-mono text-[#1D4ED8]">
                        {preview.odds.toFixed(2)}x
                      </span>
                    </span>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {preview.isExisting ? t("cached") : t("fresh")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs italic text-slate-600">
                    AI: {preview.reasoning}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("potentialPayout", { stake })}{" "}
                    <span className="font-mono font-bold text-[#1E3A8A]">
                      {Math.floor(stake * preview.odds)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {bet.options.map((o, i) => {
            const selected = optionIdx === i;
            const isMyPick = myWager?.optionIdx === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => !wagerView && !isLocked && setOptionIdx(i)}
                disabled={!!wagerView || isLocked}
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
      )}

      {wagerView ? (
        <div className="mt-4 rounded-2xl bg-[#FFF1E8] px-4 py-3 text-sm text-[#C2410C]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1">
              {t("youWagered", { stake: wagerView.stake })}{" "}
              <span className="font-bold">{bet.options[wagerView.optionIdx]?.label}</span>{" "}
              @ {Number(wagerView.oddsLocked).toFixed(2)}x.{" "}
              <span className="text-slate-500">
                {t("payout", { payout: Math.floor(wagerView.stake * Number(wagerView.oddsLocked)) })}
              </span>
            </p>
            {canEditWager && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={removing}
                  className="rounded-full border border-[#FED7AA] bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#C2410C] transition hover:bg-[#FFF7ED] disabled:opacity-50"
                >
                  {t("edit")}
                </button>
                <button
                  type="button"
                  onClick={submitRemove}
                  disabled={removing}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {removing ? t("removePending") : t("remove")}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : isLocked ? (
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          {t("locked")}
        </p>
      ) : isOpenQuestion ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={stakeMax}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-20 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono text-sm font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            / {stakeMax}
          </span>
          {isEditing && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-full border border-[#cdd9ea] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={
              !preview || !answer.trim() || stake < 1 || stake > stakeMax || pending
            }
            onClick={submitOpen}
            className="ml-auto rounded-[20px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (isEditing ? t("updatePending") : t("wagering")) : isEditing ? t("update") : t("wager")}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={stakeMax}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-20 rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-3 py-2 text-right font-mono text-sm font-bold text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            / {stakeMax}
          </span>
          {isEditing && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-full border border-[#cdd9ea] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={optionIdx === null || stake < 1 || stake > stakeMax || pending}
            onClick={submit}
            className="ml-auto rounded-[20px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_14px_26px_rgba(249,115,22,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (isEditing ? t("updatePending") : t("wagering")) : isEditing ? t("update") : t("wager")}
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
