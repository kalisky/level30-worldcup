import { and, eq, isNull, or, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authUsers, users } from "@/lib/db/schema";
import { getRoomByCode } from "@/lib/db/queries";
import type { DashboardTrace } from "@/lib/dashboard-trace";
import { getDailyGrantAmount } from "@/lib/daily-grant";
import { touchRoomLiveRevision } from "@/lib/live-updates";
import { requireProfiledUser } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";
import { recordLedger } from "@/lib/ledger";
import { DAILY_GRANT_MIN_HOURS } from "@/lib/daily-grant";

export async function requireRoomUser(
  rawCode: string,
  options?: { trace?: DashboardTrace }
) {
  const trace = options?.trace;
  const code = normalizeRoomCode(rawCode);
  const room = trace
    ? await trace.step(
        "auth.getRoomByCode",
        () => getRoomByCode(code),
        (value) => ({ roomFound: Boolean(value) })
      )
    : await getRoomByCode(code);
  if (!room) notFound();

  const authUser = trace
    ? await trace.step(
        "auth.requireProfiledUser",
        () => requireProfiledUser(`/r/${code}`),
        (value) => ({
          authUserId: value.id,
          hasDefaultRoomId: Boolean(value.defaultRoomId),
        })
      )
    : await requireProfiledUser(`/r/${code}`);

  const membershipRows = trace
    ? await trace.step(
        "auth.getRoomMembership",
        () =>
          db
            .select()
            .from(users)
            .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
            .limit(1),
        (rows) => ({ membershipFound: Boolean(rows[0]) })
      )
    : await db
        .select()
        .from(users)
        .where(and(eq(users.roomId, room.id), eq(users.authUserId, authUser.id)))
        .limit(1);
  const [user] = membershipRows;

  if (!user) redirect(`/r/${code}`);

  if (authUser.defaultRoomId !== room.id) {
    if (trace) {
      await trace.step("auth.updateDefaultRoomId", async () => {
        await db
          .update(authUsers)
          .set({ defaultRoomId: room.id })
          .where(eq(authUsers.id, authUser.id));
        return { updated: true };
      });
    } else {
      await db
        .update(authUsers)
        .set({ defaultRoomId: room.id })
        .where(eq(authUsers.id, authUser.id));
    }
  }

  const grant = getDailyGrantAmount(room.startingChips);
  let dailyGrantApplied = 0;
  if (grant > 0) {
    const dailyGrantRows = trace
      ? await trace.step(
          "auth.applyDailyGrant",
          () =>
            db
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
              .returning({ chips: users.chips, lastDailyGrantAt: users.lastDailyGrantAt }),
          (rows) => ({ grant, dailyGrantApplied: Boolean(rows[0]) })
        )
      : await db
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
    const [updated] = dailyGrantRows;

    if (updated) {
      user.chips = updated.chips;
      user.lastDailyGrantAt = updated.lastDailyGrantAt;
      dailyGrantApplied = grant;
      if (trace) {
        await trace.step("auth.recordDailyGrantLedger", async () => {
          await recordLedger(db, {
            roomId: room.id,
            userId: user.id,
            delta: grant,
            balanceAfter: updated.chips,
            reason: "daily_grant",
            note: "Daily top-up",
          });
          return { recorded: true };
        });
      } else {
        await recordLedger(db, {
          roomId: room.id,
          userId: user.id,
          delta: grant,
          balanceAfter: updated.chips,
          reason: "daily_grant",
          note: "Daily top-up",
        });
      }
      await touchRoomLiveRevision(db, room.id);
    }
  }

  return { room, user, authUser, code, dailyGrantApplied };
}
