import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireRoomUser } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { chipLedger, matches, customBets } from "@/lib/db/schema";
import { getRoomUsers } from "@/lib/db/queries";
import RoomHeader from "@/components/RoomHeader";
import DailyGrantBanner from "@/components/DailyGrantBanner";

const REASON_LABELS: Record<string, string> = {
  opening_balance: "Opening balance",
  initial: "Joined room",
  daily_grant: "Daily grant",
  match_bet_placed: "Match bet placed",
  match_bet_payout: "Match payout",
  custom_wager_placed: "Custom wager placed",
  custom_wager_payout: "Custom wager payout",
  custom_wager_refund: "Wager refund (void)",
};

const REASON_ICONS: Record<string, string> = {
  opening_balance: "📜",
  initial: "🎟️",
  daily_grant: "🎁",
  match_bet_placed: "⚽",
  match_bet_payout: "🏆",
  custom_wager_placed: "🎲",
  custom_wager_payout: "🏆",
  custom_wager_refund: "↩️",
};

function formatTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatTime(d);
}

export default async function HistoryPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ user?: string | string[] }>;
}) {
  const { code } = await props.params;
  const { user: query } = await props.searchParams;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);

  const targetUserId = (Array.isArray(query) ? query[0] : query) ?? user.id;
  const members = await getRoomUsers(room.id);
  const target = members.find((m) => m.id === targetUserId) ?? user;

  const entries = await db
    .select({
      entry: chipLedger,
      matchHome: matches.homeTeam,
      matchAway: matches.awayTeam,
      customBetTitle: customBets.title,
    })
    .from(chipLedger)
    .leftJoin(matches, eq(matches.id, chipLedger.refMatchId))
    .leftJoin(customBets, eq(customBets.id, chipLedger.refCustomBetId))
    .where(
      and(
        eq(chipLedger.roomId, room.id),
        eq(chipLedger.userId, target.id)
      )
    )
    .orderBy(desc(chipLedger.createdAt));

  return (
    <>
      <RoomHeader room={room} user={user} />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-6">
        <header className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            Chip history
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#1E3A8A]">
            {target.name}
            {target.id === user.id && (
              <span className="ml-2 rounded-full bg-[#FFF1E8] px-2.5 py-1 align-middle text-xs font-bold text-[#EA580C]">
                you
              </span>
            )}
          </h1>
          <p className="mt-2 text-3xl font-black text-[#1E3A8A]">
            <span className="font-mono">{target.chips}</span>{" "}
            <span className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">chips</span>
          </p>
        </header>

        <nav>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            View someone else's history
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const active = m.id === target.id;
              return (
                <Link
                  key={m.id}
                  href={`/r/${room.code}/history${m.id === user.id ? "" : `?user=${m.id}`}`}
                  className={
                    "rounded-full px-3.5 py-1.5 text-sm font-bold transition " +
                    (active
                      ? "bg-[#1E3A8A] text-white shadow-md"
                      : "bg-white text-[#1E3A8A] ring-1 ring-[#dbe5f2] hover:bg-[#F8FBFF]")
                  }
                >
                  {m.name}
                  {m.id === user.id && " (you)"}
                </Link>
              );
            })}
          </div>
        </nav>

        {entries.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
            No chip history yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map(({ entry, matchHome, matchAway, customBetTitle }) => {
              const positive = entry.delta >= 0;
              const reasonLabel = REASON_LABELS[entry.reason] ?? entry.reason;
              const icon = REASON_ICONS[entry.reason] ?? "•";
              const subtitle =
                entry.note ||
                (matchHome && matchAway ? `${matchHome} vs ${matchAway}` : null) ||
                (customBetTitle ? customBetTitle : null);
              const ts = new Date(entry.createdAt);
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-2xl border border-[#dbe5f2] bg-white p-4"
                >
                  <span className="text-2xl" aria-hidden>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-[#1E3A8A]">{reasonLabel}</span>
                      <span
                        className={
                          "font-mono text-lg font-black " +
                          (positive ? "text-emerald-600" : "text-rose-600")
                        }
                      >
                        {positive ? "+" : ""}
                        {entry.delta}
                      </span>
                    </div>
                    {subtitle && (
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {subtitle}
                      </p>
                    )}
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-slate-500">
                      <span title={ts.toLocaleString()}>{relativeTime(ts)}</span>
                      <span>
                        balance{" "}
                        <span className="font-mono font-semibold text-[#1E3A8A]">
                          {entry.balanceAfter}
                        </span>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
