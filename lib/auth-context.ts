import { and, eq, isNull, or, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authUsers, users } from "@/lib/db/schema";
import { getRoomSessionAccessByCode } from "@/lib/db/queries";
import type { DashboardTrace } from "@/lib/dashboard-trace";
import {
  DAILY_GRANT_MIN_HOURS,
  getDailyGrantAmount,
  hasDailyGrantStarted,
} from "@/lib/daily-grant";
import { touchRoomLiveRevision } from "@/lib/live-updates";
import { authRedirectPath, getSessionToken, profileRedirectPath } from "@/lib/auth";
import { normalizeRoomCode } from "@/lib/code";
import { recordLedger } from "@/lib/ledger";

export async function requireRoomUser(
  rawCode: string,
  options?: { trace?: DashboardTrace }
) {
  const trace = options?.trace;
  const code = normalizeRoomCode(rawCode);
  const sessionToken = await getSessionToken();
  const roomSessionAccess = trace
    ? await trace.step(
        "auth.getSessionRoomAccess",
        () => getRoomSessionAccessByCode(code, sessionToken ?? ""),
        (value) => ({
          roomFound: Boolean(value?.room),
          authUserFound: Boolean(value?.authUser),
          hasDisplayName: Boolean(value?.authUser?.displayName),
          hasDefaultRoomId: Boolean(value?.authUser?.defaultRoomId),
          membershipFound: Boolean(value?.user),
        })
      )
    : await getRoomSessionAccessByCode(code, sessionToken ?? "");
  if (!roomSessionAccess) notFound();

  const { room, authUser, user } = roomSessionAccess;

  if (!authUser) redirect(authRedirectPath(`/r/${code}`));
  if (!authUser.displayName) redirect(profileRedirectPath(`/r/${code}`));

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
  if (grant > 0 && hasDailyGrantStarted()) {
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
