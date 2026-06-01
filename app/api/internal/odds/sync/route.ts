import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateOddsSyncPaths } from "@/lib/odds-sync/revalidate";
import { syncMatchOdds } from "@/lib/odds-sync/service";

export const runtime = "nodejs";

const bodySchema = z.object({
  force: z.boolean().optional(),
  matchId: z.string().uuid().optional(),
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

  const result = await syncMatchOdds({
    force: parsed.data.force,
    matchId: parsed.data.matchId,
    trigger: "api",
  });

  if (result.syncedMatchIds.length > 0) {
    revalidateOddsSyncPaths();
  }

  return NextResponse.json(result, {
    status: result.status === "error" ? 500 : 200,
  });
}
