"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CustomBet, CustomWager } from "@/lib/db/schema";
import CustomBetCard from "@/components/CustomBetCard";
import ProposeBetModal from "@/components/ProposeBetModal";

type CustomBetCardRow = {
  bet: CustomBet;
  proposerName: string;
  myWager: CustomWager | null;
  allWagers: { wager: CustomWager; userName: string }[];
};

type MatchCustomBetsResponse = {
  items: CustomBetCardRow[];
};

function CountSkeleton({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-[#F8FBFF] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-[#dbe5f2]"
    >
      <span className="h-3 w-5 animate-pulse rounded-full bg-slate-200" />
    </span>
  );
}

function CustomBetCardSkeleton() {
  return (
    <article className="rounded-[26px] border border-[#dbe5f2] bg-white p-5 shadow-[0_14px_32px_rgba(30,58,138,0.07)]">
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="h-3 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="h-6 w-3/4 rounded-full bg-slate-200" />
        <div className="h-4 w-full rounded-full bg-slate-100" />
        <div className="h-4 w-5/6 rounded-full bg-slate-100" />
        <div className="rounded-2xl border border-[#e7eef8] bg-[#F8FBFF] p-4">
          <div className="h-4 w-24 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-10 rounded-2xl bg-white ring-1 ring-[#dbe5f2]" />
            <div className="h-10 rounded-2xl bg-white ring-1 ring-[#dbe5f2]" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MatchCustomBetsPane({
  roomCode,
  matchId,
  matchStatus,
  matchLabel,
  matchKickoff,
  viewerUserId,
  myChips,
  targetCustomBetId,
  requestKey,
}: {
  roomCode: string;
  matchId: string;
  matchStatus: "scheduled" | "live" | "final";
  matchLabel: string;
  matchKickoff: string;
  viewerUserId: string;
  myChips: number;
  targetCustomBetId?: string | null;
  requestKey: string;
}) {
  const t = useTranslations("customBet");
  const tc = useTranslations("common");
  const [items, setItems] = useState<CustomBetCardRow[]>([]);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [retryCount, setRetryCount] = useState(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedRef.current) {
      setLoadingState("loading");
    }

    const load = async () => {
      try {
        const response = await fetch(
          `/api/room/${encodeURIComponent(roomCode)}/match/${encodeURIComponent(matchId)}/custom-bets`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Custom bets request failed with ${response.status}.`);
        }

        const data = (await response.json()) as MatchCustomBetsResponse;
        hasLoadedRef.current = true;
        setItems(data.items);
        setLoadingState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;

        if (hasLoadedRef.current) {
          setLoadingState("ready");
          return;
        }

        console.error("[match-custom-bets] fetch_failed", error);
        setLoadingState("error");
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [matchId, requestKey, retryCount, roomCode]);

  useEffect(() => {
    if (!targetCustomBetId || loadingState !== "ready") return;

    const targetElementId = `custom-bet-${targetCustomBetId}`;
    const timeoutId = window.setTimeout(() => {
      document.getElementById(targetElementId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [loadingState, targetCustomBetId]);

  return (
    <section className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.28em] text-slate-500">
            {t("matchBet")}
          </h2>
        </div>
        {loadingState === "loading" ? (
          <CountSkeleton label={tc("loading")} />
        ) : (
          <span className="rounded-full bg-[#F8FBFF] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-[#dbe5f2]">
            {items.length}
          </span>
        )}
      </div>

      {matchStatus !== "final" && (
        <div className="mb-4">
          <ProposeBetModal
            roomCode={roomCode}
            matchId={matchId}
            matchLabel={matchLabel}
            matchKickoff={matchKickoff}
          />
        </div>
      )}

      {loadingState === "loading" ? (
        <div aria-label={tc("loading")} className="space-y-3">
          <CustomBetCardSkeleton />
          <CustomBetCardSkeleton />
        </div>
      ) : loadingState === "error" ? (
        <div className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          <p>{t("fetchFailed")}</p>
          <button
            type="button"
            onClick={() => {
              setLoadingState("loading");
              setRetryCount((count) => count + 1);
            }}
            className="mt-3 rounded-full border border-[#cfdced] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF]"
          >
            {tc("retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
          {t("noAnswers")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map(({ bet, proposerName, myWager, allWagers }) => (
            <CustomBetCard
              key={bet.id}
              bet={bet}
              proposerName={proposerName}
              viewerUserId={viewerUserId}
              roomCode={roomCode}
              matchId={matchId}
              highlighted={targetCustomBetId === bet.id}
              myWager={myWager}
              myChips={myChips}
              wagers={allWagers}
            />
          ))}
        </div>
      )}
    </section>
  );
}
