import { NextResponse } from "next/server";
import {
  getLivePollAccess,
} from "@/lib/live-updates";
import {
  hydrateCustomBetRowsWithWagers,
  listCustomBetsForMatch,
} from "@/lib/db/queries";

const RESPONSE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
};

export async function GET(
  _request: Request,
  props: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await props.params;
  const access = await getLivePollAccess(code);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const customBetRows = await listCustomBetsForMatch(access.room.id, id);
  const items = await hydrateCustomBetRowsWithWagers(customBetRows, access.user.id);

  return NextResponse.json({ items }, { headers: RESPONSE_HEADERS });
}
