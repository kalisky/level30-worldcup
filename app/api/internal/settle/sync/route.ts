import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { autoSettleFinishedMatches } from "@/lib/auto-settle";

export const runtime = "nodejs";
// AI lookups for several matches can take a while.
export const maxDuration = 120;

const bodySchema = z.object({
  force: z.boolean().optional(),
});

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(expected: string, provided: string) {
  return timingSafeEqual(digest(expected), digest(provided));
}

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

  const result = await autoSettleFinishedMatches({ force: parsed.data.force });
  return NextResponse.json(result);
}

// Vercel Cron backstop — cron requests are GETs carrying
// `authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
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

  const result = await autoSettleFinishedMatches();
  return NextResponse.json(result);
}
