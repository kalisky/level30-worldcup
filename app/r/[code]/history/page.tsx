import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import { db } from "@/lib/db";
import {
  chipLedger,
  matches,
  customBets,
  matchBets,
  customWagers,
} from "@/lib/db/schema";
import { getRoomLeaderboard, getRoomUsers } from "@/lib/db/queries";
import { translateTeam } from "@/lib/team-i18n";
import { customBetCopy } from "@/lib/custom-bet-copy";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import HistoryEntries, {
  type HistoryEntryItem,
} from "@/components/HistoryEntries";

function classifyEntryState(args: {
  reason: string;
  matchBetStatus: string | null;
  matchBetPayout: number | null;
  customWagerStatus: string | null;
}): HistoryEntryItem["state"] {
  if (args.reason === "match_bet_payout" || args.reason === "custom_wager_payout") {
    return "won";
  }

  if (args.reason === "match_bet_placed") {
    if (args.matchBetStatus === "open") return "open";
    if (args.matchBetStatus === "settled") {
      return (args.matchBetPayout ?? 0) > 0 ? "won" : "lost";
    }
    return "neutral";
  }

  if (args.reason === "custom_wager_placed") {
    if (args.customWagerStatus === "open") return "open";
    if (args.customWagerStatus === "won") return "won";
    if (args.customWagerStatus === "lost") return "lost";
    return "neutral";
  }

  return "neutral";
}

export default async function HistoryPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    user?: string | string[];
    from?: string | string[] | undefined;
  }>;
}) {
  const { code } = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams.user;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);
  const preferDashboardBack = Array.isArray(searchParams.from)
    ? searchParams.from[0] === "dashboard"
    : searchParams.from === "dashboard";

  const targetUserId = (Array.isArray(query) ? query[0] : query) ?? user.id;
  const [members, leaderboard] = await Promise.all([
    getRoomUsers(room.id),
    getRoomLeaderboard(room.id),
  ]);
  const target = members.find((m) => m.id === targetUserId) ?? user;
  const leaderboardTarget = leaderboard.find((m) => m.id === target.id) ?? null;

  const locale = await getLocale();
  const t = await getTranslations("history");
  const tc = await getTranslations("common");
  const tnav = await getTranslations("nav");
  const tDefaults = await getTranslations("customBet.defaults");

  const entries = await db
    .select({
      entry: chipLedger,
      matchHome: matches.homeTeam,
      matchAway: matches.awayTeam,
      customBetTitle: customBets.title,
      customBetDescription: customBets.description,
      customBetDefaultKey: customBets.defaultKey,
      matchBetStatus: matchBets.status,
      matchBetPayout: matchBets.payout,
      customWagerStatus: customWagers.status,
    })
    .from(chipLedger)
    .leftJoin(matches, eq(matches.id, chipLedger.refMatchId))
    .leftJoin(customBets, eq(customBets.id, chipLedger.refCustomBetId))
    .leftJoin(
      matchBets,
      and(
        eq(matchBets.roomId, chipLedger.roomId),
        eq(matchBets.userId, chipLedger.userId),
        eq(matchBets.matchId, chipLedger.refMatchId)
      )
    )
    .leftJoin(
      customWagers,
      and(
        eq(customWagers.userId, chipLedger.userId),
        eq(customWagers.customBetId, chipLedger.refCustomBetId)
      )
    )
    .where(
      and(
        eq(chipLedger.roomId, room.id),
        eq(chipLedger.userId, target.id)
      )
    )
    .orderBy(desc(chipLedger.createdAt));

  const historyEntries: HistoryEntryItem[] = entries.map(
    ({
      entry,
      matchHome,
      matchAway,
      customBetTitle,
      customBetDescription,
      customBetDefaultKey,
      matchBetStatus,
      matchBetPayout,
      customWagerStatus,
    }) => {
      const matchLabel =
        matchHome && matchAway
          ? `${translateTeam(matchHome, locale)} vs ${translateTeam(matchAway, locale)}`
          : null;
      const localizedBetTitle =
        customBetTitle != null
          ? customBetCopy(
              {
                title: customBetTitle,
                description: customBetDescription ?? "",
                defaultKey: customBetDefaultKey,
              },
              tDefaults
            ).title
          : null;

      return {
        id: entry.id,
        reason: entry.reason,
        delta: entry.delta,
        balanceAfter: entry.balanceAfter,
        createdAt: new Date(entry.createdAt).toISOString(),
        subtitle: entry.note || matchLabel || localizedBetTitle,
        state: classifyEntryState({
          reason: entry.reason,
          matchBetStatus,
          matchBetPayout,
          customWagerStatus,
        }),
      };
    }
  );

  return (
    <>
      <RoomHeader room={room} user={user} />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-6">
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={tnav("history")}
          preferBack={preferDashboardBack}
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
            <span className="font-mono">
              {leaderboardTarget?.chipsIncludingOpenBets ?? target.chips}
            </span>{" "}
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

        <HistoryEntries entries={historyEntries} />
      </main>
    </>
  );
}
