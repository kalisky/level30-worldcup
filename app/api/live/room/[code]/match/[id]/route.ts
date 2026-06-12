import { NextResponse, after } from "next/server";
import { autoSettleFinishedMatches } from "@/lib/auto-settle";
import {
  getLivePollMatchAccess,
  getMatchLiveToken,
} from "@/lib/live-updates";

function buildHeaders(token: string) {
  return {
    "cache-control": "private, no-store, max-age=0",
    etag: `"${token}"`,
  };
}

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await props.params;
  const access = await getLivePollMatchAccess(code, id);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Piggyback on live-poll traffic to settle finished matches server-side.
  // Cheap when there's nothing to do; throttled in the DB per match.
  after(() => autoSettleFinishedMatches().catch(() => {}));

  const token = await getMatchLiveToken({
    roomId: access.room.id,
    matchId: access.match.id,
    startingChips: access.room.startingChips,
    lastDailyGrantAt: access.user.lastDailyGrantAt,
  });
  const headers = buildHeaders(token);

  if (request.headers.get("if-none-match") === headers.etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json({ token }, { headers });
}
