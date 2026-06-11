"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StickyDashboardHeader({
  roomName,
  roomCode,
  historyLabel,
  leaderboardLabel,
}: {
  roomName: string;
  roomCode: string;
  historyLabel: string;
  leaderboardLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      // Once the user has scrolled even a little past the natural-position
      // header, switch to the compact stuck-at-top form.
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      className={
        "sticky top-[4.5rem] z-[15] -mx-4 bg-background px-4 transition-all duration-200 lg:hidden " +
        (scrolled
          ? "py-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
          : "py-3")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h1
          className={
            "min-w-0 truncate font-black text-[#1E3A8A] transition-all duration-200 " +
            (scrolled ? "text-base" : "text-[1.7rem]")
          }
        >
          {roomName}
        </h1>

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href={`/r/${roomCode}/history?from=dashboard`}
            aria-label={historyLabel}
            className={
              "inline-flex items-center justify-center rounded-full border border-[#d7deea] bg-white text-slate-700 transition hover:border-[#c3cedd] hover:bg-[#F8FBFF] hover:text-[#1E3A8A] " +
              (scrolled ? "h-8 w-8" : "h-10 w-10")
            }
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6" />
              <path d="M3.5 4.5v3.4h3.4" />
              <path d="M10 6.7v3.7l2.5 1.5" />
            </svg>
            <span className="sr-only">{historyLabel}</span>
          </Link>
          <Link
            href={`/r/${roomCode}/leaderboard?from=dashboard`}
            aria-label={leaderboardLabel}
            className={
              "inline-flex items-center justify-center rounded-full border border-[#d7deea] bg-white text-slate-700 transition hover:border-[#c3cedd] hover:bg-[#F8FBFF] hover:text-[#1E3A8A] " +
              (scrolled ? "h-8 w-8" : "h-10 w-10")
            }
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M4.5 16.5h11" />
              <path d="M6 16.5V9.5" />
              <path d="M10 16.5V5.5" />
              <path d="M14 16.5v-4" />
            </svg>
            <span className="sr-only">{leaderboardLabel}</span>
          </Link>
        </nav>
      </div>
    </section>
  );
}
