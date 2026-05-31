import type { Metadata } from "next";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customBets, matches, rooms, users } from "@/lib/db/schema";
import { normalizeRoomCode } from "@/lib/code";

const APP_NAME = "Buckeclub";

function buildMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: APP_NAME,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export const getRoomShareMetadata = cache(async (rawCode: string) => {
  const code = normalizeRoomCode(rawCode);
  if (!code) return null;

  const [room] = await db
    .select({
      roomName: rooms.name,
      creatorName: users.name,
    })
    .from(rooms)
    .leftJoin(users, and(eq(users.roomId, rooms.id), eq(users.isCreator, true)))
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) return null;

  const description = room.creatorName?.trim()
    ? `Join ${room.roomName} on ${APP_NAME}. Created by ${room.creatorName.trim()}.`
    : `Join ${room.roomName} on ${APP_NAME}.`;

  return buildMetadata(`${room.roomName} | ${APP_NAME}`, description);
});

export const getCustomBetShareMetadata = cache(
  async (rawCode: string, betId: string, matchId?: string | null) => {
    const code = normalizeRoomCode(rawCode);
    if (!code || !betId) return null;

    const [bet] = await db
      .select({
        betTitle: customBets.title,
        roomName: rooms.name,
        homeTeam: matches.homeTeam,
        awayTeam: matches.awayTeam,
      })
      .from(customBets)
      .innerJoin(rooms, eq(rooms.id, customBets.roomId))
      .leftJoin(matches, eq(matches.id, customBets.matchId))
      .where(
        matchId
          ? and(
              eq(rooms.code, code),
              eq(customBets.id, betId),
              eq(customBets.matchId, matchId)
            )
          : and(eq(rooms.code, code), eq(customBets.id, betId))
      )
      .limit(1);

    if (!bet) return null;

    const description =
      bet.homeTeam && bet.awayTeam
        ? `Custom bet for ${bet.homeTeam} vs ${bet.awayTeam} in ${bet.roomName}: ${bet.betTitle}.`
        : `Custom bet in ${bet.roomName}: ${bet.betTitle}.`;

    return buildMetadata(
      `${bet.betTitle} | ${bet.roomName} | ${APP_NAME}`,
      description
    );
  }
);
