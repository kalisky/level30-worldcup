"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  copyMatchBets,
  previewCopyMatchBets,
  type CopyBetItem,
  type CopyBetsPreview,
  type CopyBetsResult,
} from "@/lib/actions/copy-bets";
import { useTeamName } from "@/hooks/useTeamName";

type OtherRoom = { code: string; name: string };

const STATUS_KEY: Record<CopyBetItem["status"], string> = {
  copy: "statusCopy",
  skip_already_bet: "statusAlreadyBet",
  skip_kickoff_past: "statusKickoffPast",
  skip_no_odds: "statusNoOdds",
  skip_match_settled: "statusMatchSettled",
};

export default function CopyBetsDialog({
  open,
  onClose,
  targetRoomCode,
  otherRooms,
}: {
  open: boolean;
  onClose: () => void;
  targetRoomCode: string;
  otherRooms: OtherRoom[];
}) {
  const t = useTranslations("copyBets");
  const tc = useTranslations("common");
  const teamName = useTeamName();

  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<CopyBetsPreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [copying, startCopy] = useTransition();
  const [result, setResult] = useState<CopyBetsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When user picks a source, fetch preview.
  useEffect(() => {
    if (!sourceCode) {
      setPreview(null);
      return;
    }
    setError(null);
    setResult(null);
    startPreview(async () => {
      try {
        const p = await previewCopyMatchBets({
          targetRoomCode,
          sourceRoomCode: sourceCode,
        });
        setPreview(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("fetchFailed"));
        setPreview(null);
      }
    });
  }, [sourceCode, targetRoomCode, t]);

  // Reset state when dialog closes.
  useEffect(() => {
    if (!open) {
      setSourceCode(null);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function submit() {
    if (!sourceCode || !preview) return;
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("targetRoomCode", targetRoomCode);
    fd.set("sourceRoomCode", sourceCode);
    startCopy(async () => {
      try {
        const r = await copyMatchBets(fd);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("copyFailed"));
      }
    });
  }

  const notEnoughChips =
    preview &&
    preview.copyableCount > 0 &&
    preview.totalCopyableStake > preview.targetChips;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[30px] border border-[#dbe5f2] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#1E3A8A]">{t("title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#dbe5f2] px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            {tc("close")}
          </button>
        </div>

        {otherRooms.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-[#F8FBFF] px-4 py-4 text-sm text-slate-600">
            {t("noOtherRooms")}
          </p>
        ) : (
          <>
            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("pickSource")}
              </p>
              <div className="flex flex-wrap gap-2">
                {otherRooms.map((r) => {
                  const active = r.code === sourceCode;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => setSourceCode(r.code)}
                      disabled={previewing || copying}
                      className={
                        "rounded-full px-3.5 py-1.5 text-sm font-bold transition disabled:opacity-50 " +
                        (active
                          ? "bg-[#1E3A8A] text-white shadow-md"
                          : "bg-white text-[#1E3A8A] ring-1 ring-[#dbe5f2] hover:bg-[#F8FBFF]")
                      }
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {(previewing || preview || error) && (
              <div className="mt-5 flex-1 overflow-hidden rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] p-4">
                {previewing ? (
                  <p className="text-sm text-slate-500">{t("loading")}</p>
                ) : error ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : preview && !result ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-bold text-[#1E3A8A]">
                        {t("copyableCount", { count: preview.copyableCount })}{" "}
                        {preview.skippedCount > 0 && (
                          <span className="text-slate-500">
                            · {t("skippedCount", { count: preview.skippedCount })}
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {t("currentChips", { amount: preview.targetChips })}
                      </span>
                    </div>
                    {notEnoughChips && (
                      <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {t("notEnoughChips")}
                      </p>
                    )}
                    <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
                      {preview.items.map((item) => (
                        <li
                          key={item.matchId}
                          className={
                            "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm " +
                            (item.status === "copy"
                              ? "bg-white"
                              : "bg-white/60 text-slate-500")
                          }
                        >
                          <span className="flex-1 min-w-0 truncate">
                            <span className="font-semibold text-[#1E3A8A]">
                              {teamName(item.homeTeam)}{" "}
                              <span className="font-mono">
                                {item.predictedHomeScore}–{item.predictedAwayScore}
                              </span>{" "}
                              {teamName(item.awayTeam)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-slate-500">
                            {item.totalStake}
                          </span>
                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] " +
                              (item.status === "copy"
                                ? "bg-[#E0F2FE] text-[#0369A1]"
                                : "bg-slate-200 text-slate-600")
                            }
                          >
                            {t(STATUS_KEY[item.status])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : result ? (
                  <div className="text-sm text-[#1E3A8A]">
                    <p className="font-bold">
                      ✅ {t("success", { count: result.copied })}
                    </p>
                    {(result.skippedAlreadyBet ||
                      result.skippedKickoffPast ||
                      result.skippedNoOdds ||
                      result.skippedNotEnoughChips ||
                      result.skippedMatchSettled) > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        {t("skippedCount", {
                          count:
                            result.skippedAlreadyBet +
                            result.skippedKickoffPast +
                            result.skippedNoOdds +
                            result.skippedNotEnoughChips +
                            result.skippedMatchSettled,
                        })}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {preview && !result && preview.copyableCount > 0 && (
              <button
                type="button"
                disabled={copying}
                onClick={submit}
                className="mt-5 w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-4 py-3 font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copying
                  ? t("confirmPending")
                  : t("confirm", {
                      count: preview.copyableCount,
                      total: preview.totalCopyableStake,
                    })}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
