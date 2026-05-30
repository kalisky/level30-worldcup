"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/request";

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export async function setLocale(formData: FormData) {
  const requested = String(formData.get("locale") ?? "");
  if (!isLocale(requested)) throw new Error("Unsupported locale.");

  const store = await cookies();
  store.set(LOCALE_COOKIE, requested, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Re-render every page so server-rendered strings flip to the new locale.
  revalidatePath("/", "layout");
}
