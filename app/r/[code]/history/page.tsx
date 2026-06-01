import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { chipLedger, matches, customBets } from "@/lib/db/schema";
import { getRoomUsers } from "@/lib/db/queries";
import { translateTeam } from "@/lib/team-i18n";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import LocalDateTime from "@/components/LocalDateTime";

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

type RelativeStrings = {
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
};

/**
 * Returns either a localized relative-time string (e.g., "3h ago") or a
 * <LocalDateTime> element for older entries — the latter formats on the
 * client to use the viewer's timezone instead of the server's.
 */
function relativeOrAbsolute(d: Date, s: RelativeStrings) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return s.justNow;
  if (m < 60) return s.minutesAgo(m);
  const h = Math.floor(m / 60);
  if (h < 24) return s.hoursAgo(h);
  const days = Math.floor(h / 24);
  if (days < 7) return s.daysAgo(days);
  return <LocalDateTime value={d} preset="lockShort" />;
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

  const locale = await getLocale();
  const t = await getTranslations("history");
  const tc = await getTranslations("common");
  const tr = await getTranslations("history.reason");
  const tnav = await getTranslations("nav");

  const relativeStrings: RelativeStrings = {
    justNow: tc("justNow"),
    minutesAgo: (n) => `${n}m ${tc("ago")}`,
    hoursAgo: (n) => `${n}h ${tc("ago")}`,
    daysAgo: (n) => `${n}d ${tc("ago")}`,
  };

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
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={tnav("history")}
        />
        <header className="rounded-[28px] border border-[#dbe5f2] bg-white p-5 shadow-[0_16px_38px_rgba(30,58,138,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            {t("title")}
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#1E3A8A]">
            {target.name}
            {target.id === user.id && (
              <span className="ml-2 rounded-full bg-[#FFF1E8] px-2.5 py-1 align-middle text-xs font-bold text-[#EA580C]">
                {tc("you")}
              </span>
            )}
          </h1>
          <p className="mt-2 text-3xl font-black text-[#1E3A8A]">
            <span className="font-mono">{target.chips}</span>{" "}
            <span className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{t("chips")}</span>
          </p>
        </header>

        <nav>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {t("viewSomeoneElse")}
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
                  {m.id === user.id && ` (${tc("you")})`}
                </Link>
              );
            })}
          </div>
        </nav>

        {entries.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-[#cfdced] bg-[#F8FBFF] p-6 text-center text-sm text-slate-500">
            {t("noHistory")}
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map(({ entry, matchHome, matchAway, customBetTitle }) => {
              const positive = entry.delta >= 0;
              const reasonLabel = tr(entry.reason);
              const icon = REASON_ICONS[entry.reason] ?? "•";
              const matchLabel =
                matchHome && matchAway
                  ? `${translateTeam(matchHome, locale)} vs ${translateTeam(matchAway, locale)}`
                  : null;
              const subtitle =
                entry.note ||
                matchLabel ||
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
                      <span>
                        {relativeOrAbsolute(ts, relativeStrings)}
                      </span>
                      <span>
                        {t("balance")}{" "}
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
