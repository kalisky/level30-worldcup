import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAppAdmin } from "@/lib/app-admin";
import { db } from "@/lib/db";
import {
  authSessions,
  authUsers,
  customBets,
  customWagers,
  matchBets,
  rooms,
  users,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function scalar(query: Promise<{ value: number }[]>) {
  const [row] = await query;
  return row?.value ?? 0;
}

type RoomActivity = { recent: number; lastAt: Date | null };

function mergeActivity(
  map: Map<string, RoomActivity>,
  rows: { roomId: string; recent: number; lastAt: Date | null }[]
) {
  for (const row of rows) {
    const prev = map.get(row.roomId) ?? { recent: 0, lastAt: null };
    map.set(row.roomId, {
      recent: prev.recent + row.recent,
      lastAt:
        prev.lastAt && row.lastAt
          ? prev.lastAt > row.lastAt
            ? prev.lastAt
            : row.lastAt
          : prev.lastAt ?? row.lastAt,
    });
  }
}

// Activity score = user-initiated actions (match bets, custom bets, custom
// wagers) in the last 7 days. Tiers give an at-a-glance health label.
function activityLevel(score: number) {
  if (score >= 20) return { label: "Hot", cls: "bg-[#FFE4E0] text-[#DC2626]" };
  if (score >= 5) return { label: "Active", cls: "bg-emerald-100 text-emerald-700" };
  if (score >= 1) return { label: "Quiet", cls: "bg-amber-100 text-amber-700" };
  return { label: "Dormant", cls: "bg-slate-100 text-slate-500" };
}

function relativeAge(d: Date | null) {
  if (!d) return "never";
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AdminPage() {
  const authUser = await getAuthenticatedUser();
  // Hide the page entirely from anyone who isn't an app admin.
  if (!isAppAdmin(authUser?.email)) notFound();

  const now = new Date();
  // ISO string, not a Date: raw `sql` template params bypass the column type
  // encoder, and postgres-js can't bind a Date object directly.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalAuthUsers,
    totalRooms,
    totalMemberships,
    chipsInCirculation,
    totalMatchBets,
    openMatchBets,
    totalCustomBets,
    totalCustomWagers,
    activeSessions,
    matchBetAccountRows,
    customBetAccountRows,
    customWagerAccountRows,
    roomRows,
    userRows,
    matchBetActivity,
    customBetActivity,
    customWagerActivity,
    customBetsByRoomRows,
    openMatchByRoomRows,
    openWagerByRoomRows,
    openMatchByAuthRows,
    openWagerByAuthRows,
  ] = await Promise.all([
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(authUsers)),
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(rooms)),
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(users)),
    scalar(
      db.select({ value: sql<number>`coalesce(sum(${users.chips}), 0)::int` }).from(users)
    ),
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(matchBets)),
    scalar(
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(matchBets)
        .where(eq(matchBets.status, "open"))
    ),
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(customBets)),
    scalar(db.select({ value: sql<number>`count(*)::int` }).from(customWagers)),
    scalar(
      db
        .select({ value: sql<number>`count(distinct ${authSessions.authUserId})::int` })
        .from(authSessions)
        .where(gt(authSessions.expiresAt, now))
    ),
    db
      .select({ authUserId: users.authUserId })
      .from(matchBets)
      .innerJoin(users, eq(users.id, matchBets.userId))
      .where(isNotNull(users.authUserId))
      .groupBy(users.authUserId),
    db
      .select({ authUserId: users.authUserId })
      .from(customBets)
      .innerJoin(users, eq(users.id, customBets.proposerId))
      .where(isNotNull(users.authUserId))
      .groupBy(users.authUserId),
    db
      .select({ authUserId: users.authUserId })
      .from(customWagers)
      .innerJoin(users, eq(users.id, customWagers.userId))
      .where(isNotNull(users.authUserId))
      .groupBy(users.authUserId),
    // Per-room breakdown.
    db
      .select({
        id: rooms.id,
        code: rooms.code,
        name: rooms.name,
        createdAt: rooms.createdAt,
        members: sql<number>`count(${users.id})::int`,
        totalChips: sql<number>`coalesce(sum(${users.chips}), 0)::int`,
      })
      .from(rooms)
      .leftJoin(users, eq(users.roomId, rooms.id))
      .groupBy(rooms.id)
      .orderBy(desc(sql`count(${users.id})`), desc(rooms.createdAt)),
    // Per-account breakdown.
    db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        displayName: authUsers.displayName,
        googleName: authUsers.googleName,
        createdAt: authUsers.createdAt,
        roomsJoined: sql<number>`count(${users.id})::int`,
        totalChips: sql<number>`coalesce(sum(${users.chips}), 0)::int`,
      })
      .from(authUsers)
      .leftJoin(users, eq(users.authUserId, authUsers.id))
      .groupBy(authUsers.id)
      .orderBy(desc(sql`coalesce(sum(${users.chips}), 0)`)),
    // Per-room activity: recent (7d) action counts + last-action time, from
    // each user-initiated source. Merged together below.
    db
      .select({
        roomId: matchBets.roomId,
        recent: sql<number>`count(*) filter (where ${matchBets.createdAt} > ${sevenDaysAgo})::int`,
        lastAt: sql<Date | null>`max(${matchBets.createdAt})`,
      })
      .from(matchBets)
      .groupBy(matchBets.roomId),
    db
      .select({
        roomId: customBets.roomId,
        recent: sql<number>`count(*) filter (where ${customBets.createdAt} > ${sevenDaysAgo})::int`,
        lastAt: sql<Date | null>`max(${customBets.createdAt})`,
      })
      .from(customBets)
      .groupBy(customBets.roomId),
    db
      .select({
        roomId: customBets.roomId,
        recent: sql<number>`count(*) filter (where ${customWagers.createdAt} > ${sevenDaysAgo})::int`,
        lastAt: sql<Date | null>`max(${customWagers.createdAt})`,
      })
      .from(customWagers)
      .innerJoin(customBets, eq(customBets.id, customWagers.customBetId))
      .groupBy(customBets.roomId),
    // Custom bets per room, split by whether they're tied to a match
    // (in-game) or free-standing room bets (in-room).
    db
      .select({
        roomId: customBets.roomId,
        inRoom: sql<number>`count(*) filter (where ${customBets.matchId} is null)::int`,
        inGame: sql<number>`count(*) filter (where ${customBets.matchId} is not null)::int`,
      })
      .from(customBets)
      .groupBy(customBets.roomId),
    // Chips locked in still-open bets, so chip totals below match the
    // player-facing leaderboard (balance + chips in play) rather than the
    // spent-down "available" balance. Aggregated per room and per account.
    db
      .select({
        roomId: matchBets.roomId,
        stake: sql<number>`coalesce(sum(${matchBets.totalStake}), 0)::int`,
      })
      .from(matchBets)
      .where(eq(matchBets.status, "open"))
      .groupBy(matchBets.roomId),
    db
      .select({
        roomId: customBets.roomId,
        stake: sql<number>`coalesce(sum(${customWagers.stake}), 0)::int`,
      })
      .from(customWagers)
      .innerJoin(customBets, eq(customBets.id, customWagers.customBetId))
      .where(eq(customWagers.status, "open"))
      .groupBy(customBets.roomId),
    db
      .select({
        authUserId: users.authUserId,
        stake: sql<number>`coalesce(sum(${matchBets.totalStake}), 0)::int`,
      })
      .from(matchBets)
      .innerJoin(users, eq(users.id, matchBets.userId))
      .where(and(eq(matchBets.status, "open"), isNotNull(users.authUserId)))
      .groupBy(users.authUserId),
    db
      .select({
        authUserId: users.authUserId,
        stake: sql<number>`coalesce(sum(${customWagers.stake}), 0)::int`,
      })
      .from(customWagers)
      .innerJoin(users, eq(users.id, customWagers.userId))
      .where(and(eq(customWagers.status, "open"), isNotNull(users.authUserId)))
      .groupBy(users.authUserId),
  ]);

  const customBetsByRoom = new Map(
    customBetsByRoomRows.map((r) => [r.roomId, { inRoom: r.inRoom, inGame: r.inGame }])
  );

  // Chips locked in open bets, added back so the totals below match the
  // player-facing leaderboard (balance + chips in play).
  const openByRoom = new Map<string, number>();
  for (const r of openMatchByRoomRows) {
    openByRoom.set(r.roomId, (openByRoom.get(r.roomId) ?? 0) + r.stake);
  }
  for (const r of openWagerByRoomRows) {
    openByRoom.set(r.roomId, (openByRoom.get(r.roomId) ?? 0) + r.stake);
  }
  const openByAuth = new Map<string, number>();
  for (const r of openMatchByAuthRows) {
    if (r.authUserId)
      openByAuth.set(r.authUserId, (openByAuth.get(r.authUserId) ?? 0) + r.stake);
  }
  for (const r of openWagerByAuthRows) {
    if (r.authUserId)
      openByAuth.set(r.authUserId, (openByAuth.get(r.authUserId) ?? 0) + r.stake);
  }
  const totalOpenStakes = [...openByRoom.values()].reduce((s, v) => s + v, 0);

  // Fold open-bet stakes into each room's and account's chip total so admin
  // matches the leaderboard. Accounts get re-sorted since the added stakes can
  // change the order (the SQL had ordered by available chips only).
  const roomRowsWithOpen = roomRows.map((r) => ({
    ...r,
    totalChips: r.totalChips + (openByRoom.get(r.id) ?? 0),
  }));
  const userRowsWithOpen = userRows
    .map((u) => ({ ...u, totalChips: u.totalChips + (openByAuth.get(u.id) ?? 0) }))
    .sort((a, b) => b.totalChips - a.totalChips);

  const activityByRoom = new Map<string, RoomActivity>();
  mergeActivity(activityByRoom, matchBetActivity);
  mergeActivity(activityByRoom, customBetActivity);
  mergeActivity(activityByRoom, customWagerActivity);

  const bettingAccounts = new Set<string>();
  for (const row of matchBetAccountRows) {
    if (row.authUserId) bettingAccounts.add(row.authUserId);
  }
  for (const row of customBetAccountRows) {
    if (row.authUserId) bettingAccounts.add(row.authUserId);
  }
  for (const row of customWagerAccountRows) {
    if (row.authUserId) bettingAccounts.add(row.authUserId);
  }

  // Most active rooms first: by 7-day action count, then by recency of the
  // last action, then by size.
  const sortedRooms = [...roomRowsWithOpen].sort((a, b) => {
    const aa = activityByRoom.get(a.id) ?? { recent: 0, lastAt: null };
    const bb = activityByRoom.get(b.id) ?? { recent: 0, lastAt: null };
    if (bb.recent !== aa.recent) return bb.recent - aa.recent;
    const at = aa.lastAt ? new Date(aa.lastAt).getTime() : 0;
    const bt = bb.lastAt ? new Date(bb.lastAt).getTime() : 0;
    if (bt !== at) return bt - at;
    return b.members - a.members;
  });

  const stats: { label: string; value: string }[] = [
    { label: "Signed-up accounts", value: totalAuthUsers.toLocaleString() },
    { label: "Accounts with at least one bet", value: bettingAccounts.size.toLocaleString() },
    { label: "Active sessions", value: activeSessions.toLocaleString() },
    { label: "Rooms", value: totalRooms.toLocaleString() },
    { label: "Room memberships", value: totalMemberships.toLocaleString() },
    {
      label: "Chips in circulation",
      value: (chipsInCirculation + totalOpenStakes).toLocaleString(),
    },
    {
      label: "Match bets (open)",
      value: `${totalMatchBets.toLocaleString()} (${openMatchBets.toLocaleString()})`,
    },
    { label: "Custom bets", value: totalCustomBets.toLocaleString() },
    { label: "Custom wagers", value: totalCustomWagers.toLocaleString() },
  ];

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
          Buckeclub
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#1E3A8A]">Admin overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as {authUser?.email}
        </p>
        <Link
          href="/admin/checks"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1E3A8A] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1D4ED8]"
        >
          Daily settlement checks →
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[22px] border border-[#dbe5f2] bg-white p-4 shadow-[0_12px_30px_rgba(30,58,138,0.06)]"
          >
            <div className="text-2xl font-black text-[#1E3A8A]">{s.value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {s.label}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
          Rooms ({roomRows.length})
        </h2>
        <div className="overflow-x-auto rounded-[22px] border border-[#dbe5f2] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7eef8] text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Activity</th>
                <th className="px-4 py-3 text-right font-semibold">Last active</th>
                <th className="px-4 py-3 font-semibold">Custom bets</th>
                <th className="px-4 py-3 text-right font-semibold">Members</th>
                <th className="px-4 py-3 text-right font-semibold">Total chips</th>
                <th className="px-4 py-3 text-right font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {sortedRooms.map((r) => {
                const activity = activityByRoom.get(r.id) ?? { recent: 0, lastAt: null };
                const level = activityLevel(activity.recent);
                return (
                  <tr key={r.id} className="border-b border-[#f1f5fb] last:border-0">
                    <td className="px-4 py-3 font-bold text-[#1E3A8A]">
                      <Link
                        href={`/admin/room/${r.code}`}
                        className="underline-offset-2 hover:text-[#1D4ED8] hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{r.code}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${level.cls}`}
                        >
                          {level.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {activity.recent}/wk
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {relativeAge(activity.lastAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const cb = customBetsByRoom.get(r.id) ?? { inRoom: 0, inGame: 0 };
                        return (
                          <span className="whitespace-nowrap text-slate-600">
                            <span className="font-mono font-bold text-[#1E3A8A]">
                              {cb.inRoom}
                            </span>{" "}
                            room ·{" "}
                            <span className="font-mono font-bold text-[#1E3A8A]">
                              {cb.inGame}
                            </span>{" "}
                            game
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.members}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#1E3A8A]">
                      {r.totalChips.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {fmtDate(r.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
          Accounts ({userRowsWithOpen.length})
        </h2>
        <div className="overflow-x-auto rounded-[22px] border border-[#dbe5f2] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7eef8] text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 text-right font-semibold">Rooms</th>
                <th className="px-4 py-3 text-right font-semibold">Total chips</th>
                <th className="px-4 py-3 text-right font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {userRowsWithOpen.map((u) => (
                <tr key={u.id} className="border-b border-[#f1f5fb] last:border-0">
                  <td className="px-4 py-3 font-bold text-[#1E3A8A]">
                    {u.displayName || u.googleName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.roomsJoined}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#1E3A8A]">
                    {u.totalChips.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {fmtDate(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
