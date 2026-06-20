import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runDailyCheck } from "@/lib/daily-check";

export const runtime = "nodejs";
// Fetching ~12 Wikipedia group pages plus any Gemini fallbacks can take a bit.
export const maxDuration = 120;

const bodySchema = z.object({
  // Israel calendar date YYYY-MM-DD to verify. Defaults to yesterday.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  // Override the default auto-fix behavior (e.g. report-only dry check).
  autoFix: z.boolean().optional(),
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
    date: parsed.data.date,
    autoFix: parsed.data.autoFix,
  });
  return NextResponse.json(result);
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
  return NextResponse.json(result);
}
