type TraceFields = Record<string, unknown>;
type TraceSummary<T> = ((value: T) => TraceFields | undefined) | undefined;

export type RouteRenderTrace = {
  id: string;
  totalMs: number;
};

export type RouteTrace = {
  id: string;
  enabled: boolean;
  log(event: string, fields?: TraceFields): void;
  step<T>(name: string, work: () => Promise<T>, summarize?: TraceSummary<T>): Promise<T>;
  end(fields?: TraceFields): RouteRenderTrace;
  fail(error: unknown, fields?: TraceFields): void;
};

export type DashboardRenderTrace = RouteRenderTrace;
export type MatchRenderTrace = RouteRenderTrace;
export type DashboardTrace = RouteTrace;
export type MatchTrace = RouteTrace;

function nowMs() {
  return Date.now();
}

function makeTraceId(prefix: string) {
  return `${prefix}-${nowMs().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const withDigest = error as Error & { digest?: string };
    return {
      name: error.name,
      message: error.message,
      digest: withDigest.digest ?? null,
    };
  }

  return { value: String(error) };
}

export function isRouteTraceEnabled(kind?: "dashboard" | "match") {
  const debugAll = process.env.NEXT_PUBLIC_DEBUG_ROUTE_FETCH === "1";
  const debugDashboard = process.env.NEXT_PUBLIC_DEBUG_DASHBOARD_FETCH === "1";
  const debugMatch = process.env.NEXT_PUBLIC_DEBUG_MATCH_FETCH === "1";

  return (
    process.env.NODE_ENV === "development" ||
    debugAll ||
    (kind === "dashboard" ? debugDashboard : false) ||
    (kind === "match" ? debugMatch : false) ||
    debugDashboard
  );
}

function createRouteTrace(
  kind: "dashboard" | "match",
  route: string,
  fields: TraceFields = {}
): RouteTrace {
  const enabled = isRouteTraceEnabled(kind);
  const id = makeTraceId(kind);
  const startedAt = nowMs();
  const logPrefix = `[${kind}-trace]`;

  const log = (event: string, extraFields: TraceFields = {}) => {
    if (!enabled) return;
    console.info(`${logPrefix} ${event}`, {
      traceId: id,
      route,
      ...fields,
      ...extraFields,
    });
  };

  log("start");

  return {
    id,
    enabled,
    log,
    async step<T>(name: string, work: () => Promise<T>, summarize?: TraceSummary<T>) {
      if (!enabled) return work();

      const stepStartedAt = nowMs();

      try {
        const value = await work();
        log("step", {
          step: name,
          durationMs: nowMs() - stepStartedAt,
          ...(summarize?.(value) ?? {}),
        });
        return value;
      } catch (error) {
        log("step_failed", {
          step: name,
          durationMs: nowMs() - stepStartedAt,
          error: describeError(error),
        });
        throw error;
      }
    },
    end(extraFields: TraceFields = {}) {
      const totalMs = nowMs() - startedAt;
      log("complete", { totalMs, ...extraFields });
      return { id, totalMs };
    },
    fail(error: unknown, extraFields: TraceFields = {}) {
      log("failed", {
        totalMs: nowMs() - startedAt,
        error: describeError(error),
        ...extraFields,
      });
    },
  };
}

export function createDashboardTrace(
  route: string,
  fields: TraceFields = {}
): DashboardTrace {
  return createRouteTrace("dashboard", route, fields);
}

export function createMatchTrace(
  route: string,
  fields: TraceFields = {}
): MatchTrace {
  return createRouteTrace("match", route, fields);
}
