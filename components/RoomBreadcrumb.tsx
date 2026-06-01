"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export default function RoomBreadcrumb({
  roomCode,
  dashboardLabel,
  currentLabel,
  preferBack,
}: {
  roomCode: string;
  dashboardLabel: string;
  currentLabel: string;
  preferBack?: boolean;
}) {
  const router = useRouter();
  const dashboardHref = `/r/${roomCode}/dashboard`;

  function handleDashboardClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!preferBack) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof window === "undefined" || window.history.length <= 1) return;

    event.preventDefault();
    router.back();
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-2 overflow-x-auto text-sm px-1"
    >
      <Link
        href={dashboardHref}
        onClick={handleDashboardClick}
        className="group inline-flex shrink-0 items-center gap-1 font-semibold text-[#1E3A8A] transition-colors hover:text-blue-700"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor" 
          className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
        >
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        {dashboardLabel}
      </Link>
      
      <span className="shrink-0 text-slate-300">/</span>
      
      <span className="truncate font-medium text-slate-400">
        {currentLabel}
      </span>
    </nav>
  );
}
