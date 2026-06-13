import { notFound } from "next/navigation";
import { desc, eq, gt, sql } from "drizzle-orm";
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

export default async function AdminPage() {
  const authUser = await getAuthenticatedUser();
  // Hide the page entirely from anyone who isn't an app admin.
  if (!isAppAdmin(authUser?.email)) notFound();

  const now = new Date();

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
    roomRows,
    userRows,
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
  ]);

  const stats: { label: string; value: string }[] = [
    { label: "Signed-up accounts", value: totalAuthUsers.toLocaleString() },
    { label: "Active sessions", value: activeSessions.toLocaleString() },
    { label: "Rooms", value: totalRooms.toLocaleString() },
    { label: "Room memberships", value: totalMemberships.toLocaleString() },
    { label: "Chips in circulation", value: chipsInCirculation.toLocaleString() },
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
                <th className="px-4 py-3 text-right font-semibold">Members</th>
                <th className="px-4 py-3 text-right font-semibold">Total chips</th>
                <th className="px-4 py-3 text-right font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5fb] last:border-0">
                  <td className="px-4 py-3 font-bold text-[#1E3A8A]">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{r.code}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.members}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#1E3A8A]">
                    {r.totalChips.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {fmtDate(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
          Accounts ({userRows.length})
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
              {userRows.map((u) => (
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
