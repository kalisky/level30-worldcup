import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createAppSession, setAuthSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { authUsers } from "@/lib/db/schema";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { idToken?: string }
    | null;
  const idToken = body?.idToken;

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);

    const firebaseUid = decoded.uid;
    const email = decoded.email ?? null;
    const googleName =
      typeof decoded.name === "string" && decoded.name.trim().length > 0
        ? decoded.name.trim()
        : null;
    const avatarUrl =
      typeof decoded.picture === "string" && decoded.picture.length > 0
        ? decoded.picture
        : null;

    const [existing] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.firebaseUid, firebaseUid))
      .limit(1);

    const authUser =
      existing ??
      (
        await db
          .insert(authUsers)
          .values({
            firebaseUid,
            email,
            googleName,
            avatarUrl,
          })
          .returning()
      )[0];

    if (existing) {
      const [updated] = await db
        .update(authUsers)
        .set({
          email,
          googleName,
          avatarUrl,
        })
        .where(eq(authUsers.id, existing.id))
        .returning();

      const { token } = await createAppSession(updated.id);
      await setAuthSessionCookie(token);

      return NextResponse.json({
        needsProfile: !updated.displayName,
      });
    }

    const { token } = await createAppSession(authUser.id);
    await setAuthSessionCookie(token);

    return NextResponse.json({
      needsProfile: !authUser.displayName,
    });
  } catch (error) {
    console.error("Firebase session creation failed", error);
    return NextResponse.json(
      { error: "Could not verify Google login." },
      { status: 401 }
    );
  }
}
