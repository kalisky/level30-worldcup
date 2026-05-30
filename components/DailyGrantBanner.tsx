"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Floating toast shown briefly after a user's daily chip grant has been
 * credited. Auto-dismisses after ~4 seconds. Renders nothing when `amount`
 * is 0 or negative (i.e., no grant happened this visit).
 */
export default function DailyGrantBanner({ amount }: { amount: number }) {
  const t = useTranslations("dailyGrant");
  const [shown, setShown] = useState(false);
  const [removed, setRemoved] = useState(amount <= 0);

  useEffect(() => {
    if (amount <= 0) return;
    const enter = setTimeout(() => setShown(true), 50);
    const exit = setTimeout(() => setShown(false), 4500);
    const remove = setTimeout(() => setRemoved(true), 5000);
    return () => {
      clearTimeout(enter);
      clearTimeout(exit);
      clearTimeout(remove);
    };
  }, [amount]);

  if (removed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4 transition-all duration-500 " +
        (shown ? "top-24 opacity-100" : "top-16 opacity-0")
      }
    >
      <div className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] px-5 py-3 text-white shadow-2xl shadow-orange-400/50 ring-2 ring-white/40">
        <span className="text-xl" aria-hidden>🎁</span>
        <span className="text-base font-black">{t("banner", { amount })}</span>
      </div>
    </div>
  );
}
