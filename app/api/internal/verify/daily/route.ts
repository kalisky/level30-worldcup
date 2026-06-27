import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runDailyCheck } from "@/lib/daily-check";
import { syncKnockoutFixtures } from "@/lib/knockout-sync";

export const runtime = "nodejs";
// Wikipedia group pages + knockout fixture sync (+ any odds generation) can
// take a bit.
export const maxDuration = 120;

// Best-effort: pull in any newly-resolved knockout fixtures + their odds. A
// failure here must not break the settlement check, so it's swallowed.
async function syncKnockoutSafe() {
  try {
    return await syncKnockoutFixtures();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const bodySchema = z.object({
  // Override the default auto-fix behavior (e.g. report-only dry check).
  autoFix: z.boolean().optional(),
  // Re-verify matches already confirmed by a prior run.
  force: z.boolean().optional(),
});

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(expected: string, provided: string) {
  return timingSafeEqual(digest(expected), digest(provided));
}

// Manual / scripted trigger: same shared secret as the settle sync route, so
// no new env var is needed to kick a check by hand.
export async function POST(request: Request) {
  const expectedSecret = process.env.ODDS_SYNC_SHARED_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "ODDS_SYNC_SHARED_SECRET is not configured." },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get("x-odds-sync-secret")?.trim();
  if (!providedSecret || !secretsMatch(expectedSecret, providedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
      { status: 400 }
    );
  }

  const result = await runDailyCheck({
    autoFix: parsed.data.autoFix,
    force: parsed.data.force,
  });
  const knockoutSync = await syncKnockoutSafe();
  return NextResponse.json({ ...result, knockoutSync });
}

// Vercel Cron entry point — cron requests are GETs carrying
// `authorization: Bearer ${CRON_SECRET}`.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!secretsMatch(`Bearer ${cronSecret}`, auth)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runDailyCheck();
  const knockoutSync = await syncKnockoutSafe();
  return NextResponse.json({ ...result, knockoutSync });
}
