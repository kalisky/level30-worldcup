import { NextResponse } from "next/server";
import {
  getDashboardLiveToken,
  getLivePollAccess,
} from "@/lib/live-updates";

function buildHeaders(token: string) {
  return {
    "cache-control": "private, no-store, max-age=0",
    etag: `"${token}"`,
  };
}

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  const { code } = await props.params;
  const access = await getLivePollAccess(code);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const token = await getDashboardLiveToken({
    roomId: access.room.id,
    startingChips: access.room.startingChips,
    lastDailyGrantAt: access.user.lastDailyGrantAt,
  });
  const headers = buildHeaders(token);

  if (request.headers.get("if-none-match") === headers.etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json({ token }, { headers });
}
