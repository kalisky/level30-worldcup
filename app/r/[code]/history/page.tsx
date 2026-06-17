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
  settlements,
  type CustomBetOption,
} from "@/lib/db/schema";
import { getRoomLeaderboard, getRoomUsers } from "@/lib/db/queries";
import { translateTeam } from "@/lib/team-i18n";
import { customBetCopy } from "@/lib/custom-bet-copy";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import HistoryEntries, {
  type HistoryItem,
  type HistoryBetLeg,
} from "@/components/HistoryEntries";

// Ledger reasons that belong to a bet — folded into the per-bet summary rows
// instead of listed individually. Everything else (grants, opening balance,
// joining the room) stays as its own ledger row.
const BET_LEDGER_REASONS = new Set([
  "match_bet_placed",
  "match_bet_payout",
  "match_bet_refund",
  "custom_wager_placed",
  "custom_wager_payout",
  "custom_wager_refund",
  "custom_wager_canceled",
]);

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

  const tm = await getTranslations("match");

  const [ledgerRows, matchBetRows, customWagerRows, settlementRows] = await Promise.all([
    // Non-bet ledger entries — grants, opening balance, joining the room.
    db
      .select()
      .from(chipLedger)
      .where(and(eq(chipLedger.roomId, room.id), eq(chipLedger.userId, target.id)))
      .orderBy(desc(chipLedger.createdAt)),
    // One row per match the user bet on, with the match result.
    db
      .select({ bet: matchBets, match: matches })
      .from(matchBets)
      .innerJoin(matches, eq(matches.id, matchBets.matchId))
      .where(and(eq(matchBets.roomId, room.id), eq(matchBets.userId, target.id))),
    // One row per custom wager the user placed, with the bet definition.
    db
      .select({ wager: customWagers, bet: customBets })
      .from(customWagers)
      .innerJoin(customBets, eq(customBets.id, customWagers.customBetId))
      .where(and(eq(customBets.roomId, room.id), eq(customWagers.userId, target.id))),
    // Settlement events give the "closed" time for each match / custom bet.
    db
      .select({
        kind: settlements.kind,
        targetId: settlements.targetId,
        createdAt: settlements.createdAt,
      })
      .from(settlements)
      .where(eq(settlements.roomId, room.id)),
  ]);

  // Latest settlement timestamp per target — when the bet actually closed.
  const settledAtByTarget = new Map<string, Date>();
  for (const row of settlementRows) {
    const existing = settledAtByTarget.get(row.targetId);
    if (!existing || row.createdAt > existing) {
      settledAtByTarget.set(row.targetId, row.createdAt);
    }
  }

  const sideLabel = (pick: "HOME" | "DRAW" | "AWAY", home: string, away: string) =>
    pick === "HOME"
      ? translateTeam(home, locale)
      : pick === "AWAY"
        ? translateTeam(away, locale)
        : tm("draw");

  const matchBetItems: HistoryItem[] = matchBetRows.map(({ bet, match }) => {
    const settled = bet.status === "settled";
    const legs: HistoryBetLeg[] = [];
    if (bet.directionStake > 0) {
      const odds = Number(bet.directionOddsLocked);
      legs.push({
        type: "direction",
        pick: sideLabel(bet.directionPick, match.homeTeam, match.awayTeam),
        stake: bet.directionStake,
        odds,
        outcome: settled ? bet.directionOutcome : "pending",
        returned: bet.directionOutcome === "won" ? Math.ceil(bet.directionStake * odds) : 0,
      });
    }
    if (bet.scoreStake > 0) {
      const odds = Number(bet.scoreOddsLocked);
      legs.push({
        type: "score",
        pick: `${bet.predictedHomeScore}–${bet.predictedAwayScore}`,
        stake: bet.scoreStake,
        odds,
        outcome: settled ? bet.scoreOutcome : "pending",
        returned: bet.scoreOutcome === "won" ? Math.ceil(bet.scoreStake * odds) : 0,
      });
    }
    const net = settled ? (bet.payout ?? 0) - bet.totalStake : null;
    return {
      kind: "bet",
      id: `match-${bet.id}`,
      title: `${translateTeam(match.homeTeam, locale)} ${tm("vs")} ${translateTeam(match.awayTeam, locale)}`,
      resultLine:
        match.status === "final" && match.homeScore != null && match.awayScore != null
          ? `${tm("final")} ${match.homeScore}–${match.awayScore}`
          : null,
      legs,
      totalStake: bet.totalStake,
      state: settled ? (net! >= 0 ? "won" : "lost") : "open",
      net,
      // Sort/display by when the match closed; fall back to placement time.
      createdAt: (settledAtByTarget.get(match.id) ?? new Date(bet.createdAt)).toISOString(),
    };
  });

  const customBetItems: HistoryItem[] = customWagerRows.map(({ wager, bet }) => {
    const options = bet.options as CustomBetOption[];
    const localized = customBetCopy(
      { title: bet.title, description: bet.description ?? "", defaultKey: bet.defaultKey },
      tDefaults
    );
    const odds = Number(wager.oddsLocked);
    const won = wager.status === "won";
    const settled = wager.status === "won" || wager.status === "lost";
    const voided = wager.status === "void";
    const net = voided ? 0 : settled ? (won ? Math.ceil(wager.stake * odds) : 0) - wager.stake : null;
    return {
      kind: "bet",
      id: `custom-${wager.id}`,
      title: localized.title,
      resultLine:
        bet.winningOptionIdx != null
          ? `${tm("winner")}: ${options[bet.winningOptionIdx]?.label ?? "?"}`
          : voided
            ? tm("voided")
            : null,
      legs: [
        {
          type: "custom",
          pick: options[wager.optionIdx]?.label ?? "?",
          stake: wager.stake,
          odds,
          outcome: voided ? "void" : settled ? (won ? "won" : "lost") : "pending",
          returned: won ? Math.ceil(wager.stake * odds) : 0,
        },
      ],
      totalStake: wager.stake,
      state: voided ? "void" : settled ? (net! >= 0 ? "won" : "lost") : "open",
      net,
      createdAt: (settledAtByTarget.get(bet.id) ?? new Date(wager.createdAt)).toISOString(),
    };
  });

  const ledgerItems: HistoryItem[] = ledgerRows
    .filter((entry) => !BET_LEDGER_REASONS.has(entry.reason))
    .map((entry) => ({
      kind: "ledger",
      id: `ledger-${entry.id}`,
      reason: entry.reason,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      subtitle: entry.note || null,
      createdAt: new Date(entry.createdAt).toISOString(),
    }));

  const historyEntries: HistoryItem[] = [
    ...matchBetItems,
    ...customBetItems,
    ...ledgerItems,
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
