import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAppAdmin } from "@/lib/app-admin";
import { db } from "@/lib/db";
import {
  dailyChecks,
  type DailyCheck,
  type DailyCheckMatchReport,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ok: { label: "All correct", cls: "bg-emerald-100 text-emerald-700" },
  issues: { label: "Issues found", cls: "bg-[#FFE4E0] text-[#DC2626]" },
  error: { label: "Run failed", cls: "bg-amber-100 text-amber-700" },
};

const VERDICT_STYLE: Record<string, { label: string; cls: string }> = {
  ok: { label: "ok", cls: "bg-emerald-100 text-emerald-700" },
  "no-bets": { label: "no bets", cls: "bg-slate-100 text-slate-500" },
  unverified: { label: "unverified", cls: "bg-amber-100 text-amber-700" },
  "score-mismatch": {
    label: "score mismatch",
    cls: "bg-[#FFE4E0] text-[#DC2626]",
  },
  "chip-mismatch": {
    label: "chip mismatch",
    cls: "bg-[#FFE4E0] text-[#DC2626]",
  },
};

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchRow({ m }: { m: DailyCheckMatchReport }) {
  const v = VERDICT_STYLE[m.verdict] ?? {
    label: m.verdict,
    cls: "bg-slate-100 text-slate-500",
  };
  const interesting =
    m.verdict === "score-mismatch" ||
    m.verdict === "chip-mismatch" ||
    m.verdict === "unverified";
  return (
    <div
      className={`rounded-[16px] border p-3 text-sm ${
        interesting ? "border-[#f3c6c0] bg-[#FFF7F6]" : "border-[#eef3fa] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.cls}`}>
          {v.label}
        </span>
        <span className="font-bold text-[#1E3A8A]">{m.match}</span>
        <span className="text-xs text-slate-500">
          stored {m.storedScore ?? "—"} · source {m.authoritativeScore ?? "—"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{m.reasoning}</p>

      {m.autoFix && (
        <p
          className={`mt-2 text-xs font-semibold ${
            m.autoFix.applied ? "text-emerald-700" : "text-[#DC2626]"
          }`}
        >
          {m.autoFix.applied
            ? `Auto-fixed ${m.autoFix.fromScore ?? "—"} → ${m.autoFix.toScore}: re-settled ${m.autoFix.betsResettled} bets in ${m.autoFix.roomsResettled} rooms, reversed ${m.autoFix.chipsReversed} chips, paid out ${m.autoFix.chipsPaidOut}.`
            : `Auto-fix FAILED: ${m.autoFix.error ?? "unknown error"}`}
        </p>
      )}

      {m.chipDiscrepancies && m.chipDiscrepancies.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-3 font-semibold">Bet</th>
                <th className="py-1 pr-3 font-semibold">Stored</th>
                <th className="py-1 pr-3 font-semibold">Expected</th>
                <th className="py-1 pr-3 font-semibold">Stored payout</th>
                <th className="py-1 font-semibold">Expected payout</th>
              </tr>
            </thead>
            <tbody>
              {m.chipDiscrepancies.map((d) => (
                <tr key={d.betId} className="border-t border-[#f1f5fb]">
                  <td className="py-1 pr-3 font-mono text-slate-400">
                    {d.betId.slice(0, 8)}
                  </td>
                  <td className="py-1 pr-3">
                    {d.storedDirectionOutcome}/{d.storedScoreOutcome}
                  </td>
                  <td className="py-1 pr-3">
                    {d.expectedDirectionOutcome}/{d.expectedScoreOutcome}
                  </td>
                  <td className="py-1 pr-3 font-mono">{d.storedPayout ?? "—"}</td>
                  <td className="py-1 font-mono font-bold text-[#1E3A8A]">
                    {d.expectedPayout}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunCard({ run }: { run: DailyCheck }) {
  const status = STATUS_STYLE[run.status] ?? {
    label: run.status,
    cls: "bg-slate-100 text-slate-500",
  };
  const matches = run.report?.matches ?? [];
  // Lead with anything noteworthy.
  const ordered = [...matches].sort((a, b) => {
    const rank = (v: string) =>
      v === "score-mismatch" || v === "chip-mismatch"
        ? 0
        : v === "unverified"
          ? 1
          : 2;
    return rank(a.verdict) - rank(b.verdict);
  });

  return (
    <div className="rounded-[22px] border border-[#dbe5f2] bg-white p-4 shadow-[0_12px_30px_rgba(30,58,138,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.cls}`}
          >
            {status.label}
          </span>
          <span className="font-black text-[#1E3A8A]">{run.checkDate}</span>
        </div>
        <span className="text-xs text-slate-500">
          ran {fmtDateTime(run.ranAt)}
        </span>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {run.matchesChecked} matches checked · {run.issuesFound} issue
        {run.issuesFound === 1 ? "" : "s"} · {run.autoFixed} auto-fixed
      </div>

      {run.report?.error && (
        <p className="mt-2 text-xs font-semibold text-[#DC2626]">
          {run.report.error}
        </p>
      )}

      {ordered.length > 0 && (
        <div className="mt-3 space-y-2">
          {ordered.map((m) => (
            <MatchRow key={m.matchId} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AdminChecksPage() {
  const authUser = await getAuthenticatedUser();
  if (!isAppAdmin(authUser?.email)) notFound();

  const runs = await db
    .select()
    .from(dailyChecks)
    .orderBy(desc(dailyChecks.ranAt))
    .limit(30);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 space-y-6">
      <header>
        <Link
          href="/admin"
          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
        >
          ← Admin overview
        </Link>
        <h1 className="mt-2 text-3xl font-black text-[#1E3A8A]">
          Daily settlement checks
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every morning (08:00 Israel) each of the prior day&apos;s matches is
          re-checked against Wikipedia and every bet&apos;s payout is recomputed.
          Score-pull mismatches are auto-fixed; chip mismatches are flagged here.
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[#cdd9ec] bg-white p-8 text-center text-sm text-slate-500">
          No checks have run yet. The first run will appear here after the next
          08:00 cron (or a manual trigger).
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </main>
  );
}
