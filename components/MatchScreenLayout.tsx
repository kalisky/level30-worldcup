"use client";

import { useState } from "react";

export default function MatchScreenLayout({
  matchPane,
  customBetsPane,
}: {
  matchPane: React.ReactNode;
  customBetsPane: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"match" | "custom">("match");

  return (
    <>
      <div className="lg:hidden">
        <div className="rounded-[24px] mb-4 border border-[#dbe5f2] bg-[#F8FBFF] p-1 shadow-[0_10px_24px_rgba(30,58,138,0.06)]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("match")}
              className={
                "rounded-[18px] px-4 py-3 text-sm font-bold transition " +
                (activeTab === "match"
                  ? "bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] text-white shadow-[0_10px_24px_rgba(30,58,138,0.22)]"
                  : "text-slate-600 hover:bg-white hover:text-[#1E3A8A]")
              }
            >
              Match &amp; Odds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={
                "rounded-[18px] px-4 py-3 text-sm font-bold transition " +
                (activeTab === "custom"
                  ? "bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
                  : "text-slate-600 hover:bg-white hover:text-[#1E3A8A]")
              }
            >
              Custom Bets
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
            " lg:sticky lg:top-28 lg:block lg:self-start"
          }
        >
          {customBetsPane}
        </aside>
      </div>
    </>
  );
}
