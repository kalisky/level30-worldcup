"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAppAdmin } from "@/lib/app-admin";
import { runDailyCheck } from "@/lib/daily-check";

/**
 * Admin-triggered "Check now" for /admin/checks. Runs the same verification as
 * the morning cron, but with `force` so it re-verifies everything in the recent
 * window (not just matches not yet handled) — an on-demand "is everything
 * correct right now?" sweep. Auto-fixes score-pull mismatches like the cron.
 */
export async function runCheckNowAction() {
  const authUser = await getAuthenticatedUser();
  if (!isAppAdmin(authUser?.email)) {
    throw new Error("Unauthorized.");
  }
  await runDailyCheck({ force: true });
  revalidatePath("/admin/checks");
}
