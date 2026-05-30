"use server";

import { clearAuthSessionCookie, deleteCurrentAuthSession } from "@/lib/auth";

export async function signOut() {
  await deleteCurrentAuthSession();
  await clearAuthSessionCookie();
}
