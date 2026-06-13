import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAppAdmin } from "@/lib/app-admin";
import { db } from "@/lib/db";
import {
  authUsers,
  customBets,
  customWagers,
  matchBets,
  rooms,
  users,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminRoomPage(props: {
  params: Promise<{ code: string }>;
}) {
  const authUser = await getAuthenticatedUser();
  if (!isAppAdmin(authUser?.email)) notFound();

  const { code } = await props.params;
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!room) notFound();

  const [participants, matchBetCounts, customWagerCounts] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        chips: users.chips,
        isCreator: users.isCreator,
        createdAt: users.createdAt,
        email: authUsers.email,
      })
      .from(users)
      .leftJoin(authUsers, eq(authUsers.id, users.authUserId))
      .where(eq(users.roomId, room.id))
      .orderBy(desc(users.chips)),
    db
      .select({
        userId: matchBets.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(matchBets)
      .where(eq(matchBets.roomId, room.id))
      .groupBy(matchBets.userId),
    db
      .select({
        userId: customWagers.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(customWagers)
      .innerJoin(customBets, eq(customBets.id, customWagers.customBetId))
      .where(and(eq(customBets.roomId, room.id)))
      .groupBy(customWagers.userId),
  ]);

  const matchBetsByUser = new Map(matchBetCounts.map((r) => [r.userId, r.count]));
  const customWagersByUser = new Map(customWagerCounts.map((r) => [r.userId, r.count]));
  const totalChips = participants.reduce((sum, p) => sum + p.chips, 0);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-[#1D4ED8] hover:underline"
        >
          ← Admin overview
        </Link>
      </div>

      <header>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
          Room <span className="font-mono">{room.code}</span>
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#1E3A8A]">{room.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {participants.length} participants · {totalChips.toLocaleString()} chips ·
          created {fmtDate(room.createdAt)}
        </p>
      </header>

      <section className="overflow-x-auto rounded-[22px] border border-[#dbe5f2] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e7eef8] text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <th className="px-4 py-3 font-semibold">Participant</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 text-right font-semibold">Chips</th>
              <th className="px-4 py-3 text-right font-semibold">Match bets</th>
              <th className="px-4 py-3 text-right font-semibold">Custom wagers</th>
              <th className="px-4 py-3 text-right font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b border-[#f1f5fb] last:border-0">
                <td className="px-4 py-3 font-bold text-[#1E3A8A]">
                  {p.name}
                  {p.isCreator && (
                    <span className="ml-2 rounded-full bg-[#E0EEFF] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#1D4ED8]">
                      Admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{p.email || "—"}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#1E3A8A]">
                  {p.chips.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {matchBetsByUser.get(p.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {customWagersByUser.get(p.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-500">
                  {fmtDate(p.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
