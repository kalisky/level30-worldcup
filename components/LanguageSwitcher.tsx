"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";

/** Tiny pill that toggles between English and Hebrew. */
export default function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("language");
  const [pending, startTransition] = useTransition();

  function switchTo(target: "en" | "he") {
    if (target === locale) return;
    const fd = new FormData();
    fd.set("locale", target);
    startTransition(async () => {
      await setLocale(fd);
    });
  }

  const next = locale === "he" ? "en" : "he";

  return (
    <button
      type="button"
      onClick={() => switchTo(next)}
      disabled={pending}
      aria-label={`Switch language to ${t("switchTo")}`}
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-[#cdd9ea] bg-white px-3 py-1.5 text-xs font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:cursor-progress disabled:opacity-60 " +
        (className ?? "")
      }
    >
      <span aria-hidden>🌐</span>
      {t("switchTo")}
    </button>
  );
}
