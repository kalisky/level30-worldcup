"use client";

import { useEffect, useState } from "react";

export default function MatchScreenLayout({
  matchPane,
  customBetsPane,
  matchTabLabel = "Match & Odds",
  customBetsTabLabel = "Custom Bets",
  targetCustomBetId,
  initialTab = "match",
  // Where the desktop sidebar pins. The dashboard has an extra sticky header
  // bar below the app header, so it pushes the sidebar down to clear it.
  asideStickyTopClass = "lg:top-28",
  asideMaxHeightClass = "lg:max-h-[calc(100vh-8rem)]",
}: {
  matchPane: React.ReactNode;
  customBetsPane: React.ReactNode;
  matchTabLabel?: string;
  customBetsTabLabel?: string;
  targetCustomBetId?: string | null;
  initialTab?: "match" | "custom";
  asideStickyTopClass?: string;
  asideMaxHeightClass?: string;
}) {
  const [activeTab, setActiveTab] = useState<"match" | "custom">(() =>
    targetCustomBetId ? "custom" : initialTab
  );

  useEffect(() => {
    if (!targetCustomBetId) return;

    const tabTimeout = window.setTimeout(() => {
      setActiveTab("custom");
    }, 0);

    const targetElementId = `custom-bet-${targetCustomBetId}`;
    let cancelled = false;
    let attempts = 0;

    const scrollToTarget = () => {
      if (cancelled) return;

      const element = document.getElementById(targetElementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempts < 8) {
        attempts += 1;
        window.setTimeout(scrollToTarget, 120);
      }
    };

    window.setTimeout(scrollToTarget, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(tabTimeout);
    };
  }, [targetCustomBetId]);

  return (
    <>
      <div className="sticky top-[7rem] z-10 -mx-4 mb-4 bg-background px-4 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.06)] lg:hidden">
        <div className="rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] p-1 shadow-[0_10px_24px_rgba(30,58,138,0.06)]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("match")}
              className={
                "rounded-[18px] px-4 py-3 text-sm font-bold transition " +
                (activeTab === "match"
                  ? "rounded-[18px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] text-white shadow-[0_10px_24px_rgba(30,58,138,0.22)]"
                  : "text-slate-600 hover:bg-white hover:text-[#1E3A8A]")
              }
            >
              {matchTabLabel}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={
                "rounded-[18px] px-4 py-3 text-sm font-bold transition " +
                (activeTab === "custom"
                  ? "rounded-[18px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
                  : "text-slate-600 hover:bg-white hover:text-[#1E3A8A]")
              }
            >
              {customBetsTabLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.88fr)] lg:gap-6">
        <div
          className={
            "space-y-6 " +
            (activeTab === "match" ? "block" : "hidden") +
            " lg:block"
          }
        >
          {matchPane}
        </div>

        <aside
          className={
            "space-y-4 " +
            (activeTab === "custom" ? "block" : "hidden") +
            ` lg:sticky ${asideStickyTopClass} lg:block ${asideMaxHeightClass} lg:self-start lg:overflow-y-auto lg:pr-1`
          }
        >
          {customBetsPane}
        </aside>
      </div>
    </>
  );
}
