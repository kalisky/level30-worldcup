import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRoomUser } from "@/lib/auth-context";
import { ensureFreshCustomBetOdds } from "@/lib/custom-bet-odds";
import { db } from "@/lib/db";
import { customBets, customWagers, matches, users } from "@/lib/db/schema";
import { listRecentSettlements } from "@/lib/db/queries";
import { translateTeam } from "@/lib/team-i18n";
import RoomHeader from "@/components/RoomHeader";
import RoomBreadcrumb from "@/components/RoomBreadcrumb";
import SettleMatchForm from "@/components/SettleMatchForm";
import SettleCustomBet from "@/components/SettleCustomBet";
import DailyGrantBanner from "@/components/DailyGrantBanner";
import LocalDateTime from "@/components/LocalDateTime";

export default async function AdminPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const { room, user, dailyGrantApplied } = await requireRoomUser(code);
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tm = await getTranslations("match");
  const tnav = await getTranslations("nav");

  const [allMatches, openBetsRaw, recent] = await Promise.all([
    db.select().from(matches).orderBy(matches.kickoff),
    db
      .select({
        bet: customBets,
        proposerName: users.name,
        wagererCount: sql<number>`(
          SELECT COUNT(DISTINCT ${customWagers.userId})::int
          FROM ${customWagers}
          WHERE ${customWagers.customBetId} = ${customBets.id}
        )`,
      })
      .from(customBets)
      .innerJoin(users, eq(users.id, customBets.proposerId))
      .where(
        and(
          eq(customBets.roomId, room.id),
          inArray(customBets.status, ["open", "locked"])
        )
      )
      .orderBy(desc(customBets.createdAt)),
    listRecentSettlements(room.id, 30),
  ]);
  const openBets = await Promise.all(
    openBetsRaw.map(async (entry) => ({
      ...entry,
      bet: await ensureFreshCustomBetOdds(db, entry.bet),
    }))
  );

  // Split matches into 'needs attention' (past kickoff, not final) and rest.
  const now = new Date();
  const needsAttention = allMatches.filter(
    (m) => m.status !== "final" && new Date(m.kickoff) <= now
  );
  const upcoming = allMatches.filter(
    (m) => m.status !== "final" && new Date(m.kickoff) > now
  );
  const completed = allMatches.filter((m) => m.status === "final");

  return (
    <>
      <RoomHeader room={room} user={user} active="admin" />
      <DailyGrantBanner amount={dailyGrantApplied} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-8">
        <RoomBreadcrumb
          roomCode={room.code}
          dashboardLabel={tnav("dashboard")}
          currentLabel={tnav("settle")}
        />
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("needsSettlement", { count: needsAttention.length })}
          </h2>
          {needsAttention.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("nothingPending")}</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.map((m) => (
                <SettleMatchForm key={m.id} match={m} roomCode={room.code} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("openCustomBets", { count: openBets.length })}
          </h2>
          {openBets.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("noCustomBets")}</p>
          ) : (
            <div className="space-y-2">
              {openBets.map(({ bet, proposerName, wagererCount }) => (
                <SettleCustomBet
                  key={bet.id}
                  bet={bet}
                  roomCode={room.code}
                  proposerName={proposerName}
                  wagererCount={wagererCount}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {t("upcomingMatches", { count: upcoming.length })}
            </summary>
            <div className="mt-3 space-y-2">
              {upcoming.map((m) => (
                <SettleMatchForm key={m.id} match={m} roomCode={room.code} />
              ))}
            </div>
          </details>
        </section>

        <section>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {t("completed", { count: completed.length })}
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm">
              {completed.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span>
                    {translateTeam(m.homeTeam, locale)} {m.homeScore} – {m.awayScore} {translateTeam(m.awayTeam, locale)}
                  </span>
                  <span className="text-xs text-zinc-500">{tm("group")} {m.groupLabel}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("recentSettlements")}
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("nothingYet")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recent.map(({ settlement, actorName }) => (
                <li
                  key={settlement.id}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {settlement.kind === "match"
                        ? t("matchSettled")
                        : settlement.kind === "custom_bet"
                          ? t("customBetSettled")
                          : t("customBetVoided")}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {t("by")} {actorName} ·{" "}
                      <LocalDateTime value={settlement.createdAt} preset="datetime" />
                    </span>
                  </div>
                  <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                    {JSON.stringify(settlement.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
