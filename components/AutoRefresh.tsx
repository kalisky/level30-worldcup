"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshProps = {
  intervalMs?: number;
  pollUrl: string;
  liveToken?: string | null;
  traceLabel?: string;
  requestTimeoutMs?: number;
  maxBackoffMs?: number;
};

type LivePollResponse = {
  token: string;
};

/**
 * Polls a lightweight JSON endpoint while the tab is visible and online, and
 * only refreshes the current route when the server reports a new live token.
 */
export default function AutoRefresh({
  intervalMs = 60_000,
  pollUrl,
  liveToken = null,
  traceLabel,
  requestTimeoutMs = 15_000,
  maxBackoffMs = 5 * 60_000,
}: AutoRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const debugEnabled = traceLabel ? process.env.NODE_ENV === "development" : false;

  const tokenRef = useRef<string | null>(liveToken);
  const pendingRef = useRef(isPending);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);
  const refreshingRef = useRef(false);
  const failureCountRef = useRef(0);
  const logPollRef = useRef<(event: string, fields?: Record<string, unknown>) => void>(
    () => {}
  );
  const scheduleNextPollRef = useRef<(delayMs: number) => void>(() => {});

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const previousToken = tokenRef.current;
    if (liveToken != null) {
      tokenRef.current = liveToken;
    }

    if (!refreshingRef.current || liveToken == null) return;

    refreshingRef.current = false;
    logPollRef.current("refresh_applied", {
      tokenChanged: previousToken !== liveToken,
    });
    scheduleNextPollRef.current(intervalMs);
  }, [intervalMs, liveToken]);

  useEffect(() => {
    if (isPending || !refreshingRef.current) return;

    refreshingRef.current = false;
    if (liveToken != null) {
      tokenRef.current = liveToken;
    }
    logPollRef.current("refresh_settled", {
      tokenSuppliedByServer: liveToken != null,
    });
    scheduleNextPollRef.current(intervalMs);
  }, [intervalMs, isPending, liveToken]);

  useEffect(() => {
    if (!debugEnabled || !isPending) return;
    logPollRef.current("route_refresh_pending");
  }, [debugEnabled, isPending]);

  useEffect(() => {
    const clearScheduledPoll = () => {
      if (timerRef.current == null) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const clearInFlightPoll = () => {
      abortRef.current?.abort();
      abortRef.current = null;
      pollingRef.current = false;
    };

    const logPoll = (event: string, fields: Record<string, unknown> = {}) => {
      if (!debugEnabled) return;
      console.info(`[live-refresh] ${event}`, {
        traceLabel,
        pollUrl,
        ...fields,
      });
    };
    logPollRef.current = logPoll;

    const triggerRouteRefresh = (reason: string, nextToken?: string) => {
      if (refreshingRef.current || pendingRef.current) {
        logPoll("refresh_already_pending", { reason });
        return;
      }

      if (nextToken) {
        tokenRef.current = nextToken;
      }

      refreshingRef.current = true;
      logPoll("refresh_route", { reason });
      startTransition(() => {
        router.refresh();
      });
    };

    const scheduleNextPoll = (delayMs: number) => {
      clearScheduledPoll();

      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        logPoll("skip_hidden");
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        logPoll("skip_offline");
        return;
      }

      timerRef.current = setTimeout(() => {
        void performPoll();
      }, delayMs);
    };
    scheduleNextPollRef.current = scheduleNextPoll;

    const performPoll = async () => {
      if (pollingRef.current) {
        logPoll("skip_overlap");
        return;
      }

      if (refreshingRef.current || pendingRef.current) {
        logPoll("skip_refresh_pending");
        scheduleNextPoll(intervalMs);
        return;
      }

      if (document.visibilityState !== "visible") {
        logPoll("skip_hidden");
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        logPoll("skip_offline");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      abortRef.current = controller;
      pollingRef.current = true;

      try {
        const response = await fetch(pollUrl, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers:
            tokenRef.current == null
              ? {
                  accept: "application/json",
                }
              : {
                  accept: "application/json",
                  "if-none-match": `"${tokenRef.current}"`,
                },
          signal: controller.signal,
        });

        if (response.status === 304) {
          failureCountRef.current = 0;
          logPoll("unchanged");
          scheduleNextPoll(intervalMs);
          return;
        }

        if (response.status === 401 || response.status === 403 || response.status === 404) {
          logPoll("refresh_on_terminal_status", { status: response.status });
          triggerRouteRefresh(`status_${response.status}`);
          return;
        }

        if (!response.ok) {
          throw new Error(`Polling failed with ${response.status}.`);
        }

        const data = (await response.json()) as LivePollResponse;
        failureCountRef.current = 0;

        if (tokenRef.current == null) {
          tokenRef.current = data.token;
          logPoll("seeded", {
            nextToken: data.token,
          });
          scheduleNextPoll(intervalMs);
          return;
        }

        if (data.token !== tokenRef.current) {
          logPoll("changed", {
            previousToken: tokenRef.current,
            nextToken: data.token,
          });
          triggerRouteRefresh("token_changed", data.token);
          return;
        }

        logPoll("unchanged");
        scheduleNextPoll(intervalMs);
      } catch (error) {
        if (controller.signal.aborted) {
          logPoll("aborted");
          return;
        }

        failureCountRef.current += 1;
        const delayMs = Math.min(
          intervalMs * 2 ** Math.min(failureCountRef.current - 1, 3),
          maxBackoffMs
        );

        logPoll("error", {
          failures: failureCountRef.current,
          retryInMs: delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
        scheduleNextPoll(delayMs);
      } finally {
        clearTimeout(timeoutId);
        abortRef.current = null;
        pollingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logPoll("visible");
        scheduleNextPoll(0);
        return;
      }

      logPoll("hidden");
      clearScheduledPoll();
      clearInFlightPoll();
    };

    const handleOnline = () => {
      logPoll("online");
      scheduleNextPoll(0);
    };

    const handleOffline = () => {
      logPoll("offline");
      clearScheduledPoll();
      clearInFlightPoll();
    };

    scheduleNextPoll(tokenRef.current == null ? 0 : intervalMs);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearScheduledPoll();
      clearInFlightPoll();
      logPollRef.current = () => {};
      scheduleNextPollRef.current = () => {};
    };
  }, [
    debugEnabled,
    intervalMs,
    maxBackoffMs,
    pollUrl,
    requestTimeoutMs,
    router,
    startTransition,
    traceLabel,
  ]);

  return null;
}
