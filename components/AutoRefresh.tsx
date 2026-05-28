"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the server every `intervalMs` and refreshes server-rendered data on
 * the current page. Keep this mounted inside server pages that show live state
 * (dashboard, match page, custom bet feed).
 */
export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
