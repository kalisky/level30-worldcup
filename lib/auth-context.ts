import { and, eq, isNull, or, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authUsers, users } from "@/lib/db/schema";
import { getRoomByCode } from "@/lib/db/queries";
import { requireProfiledUser } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";
import { recordLedger } from "@/lib/ledger";

// Daily top-up: 1/10th of the room's starting chips. Anyone visiting after
// ~a day since their last grant gets one credit. The update is conditional
// so concurrent page loads can't double-credit.
const DAILY_GRANT_FRACTION = 10; // 1/10th of starting chips
const DAILY_GRANT_MIN_HOURS = 20; // user can collect again after ~20h

export async function requireRoomUser(rawCode: string) {
  const code = normalizeRoomCode(rawCode);
  const room = await getRoomByCode(code);
  if (!room) notFound();

  const authUser = await requireProfiledUser(`/r/${code}`);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
    .limit(1);

  if (!user) redirect(`/r/${code}`);

  if (authUser.defaultRoomId !== room.id) {
    await db
      .update(authUsers)
      .set({ defaultRoomId: room.id })
      .where(eq(authUsers.id, authUser.id));
  }

  const grant = Math.floor(room.startingChips / DAILY_GRANT_FRACTION);
  let dailyGrantApplied = 0;
  if (grant > 0) {
    const [updated] = await db
      .update(users)
      .set({
        chips: sql`${users.chips} + ${grant}`,
        lastDailyGrantAt: sql`now()`,
      })
      .where(
        and(
          eq(users.id, user.id),
          or(
            isNull(users.lastDailyGrantAt),
            sql`${users.lastDailyGrantAt} < now() - interval '${sql.raw(String(DAILY_GRANT_MIN_HOURS))} hours'`
          )
        )
      )
      .returning({ chips: users.chips, lastDailyGrantAt: users.lastDailyGrantAt });

    if (updated) {
      user.chips = updated.chips;
      user.lastDailyGrantAt = updated.lastDailyGrantAt;
      dailyGrantApplied = grant;
      await recordLedger(db, {
        roomId: room.id,
        userId: user.id,
        delta: grant,
        balanceAfter: updated.chips,
        reason: "daily_grant",
        note: "Daily top-up",
      });
    }
  }

  return { room, user, authUser, code, dailyGrantApplied };
}
