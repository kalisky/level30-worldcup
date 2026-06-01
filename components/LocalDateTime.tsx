"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

/**
 * Formats a timestamp in the *user's* timezone and active app locale.
 *
 * Why a dedicated component: server components render with the server's
 * timezone (UTC on Vercel), so a plain `date.toLocaleString()` in a server
 * page or RSC component shows UTC times. By bouncing the format through a
 * client component we use the browser's timezone. We render the same value
 * on first paint via a lazy `useState` initializer (which on the server
 * computes UTC, on the client computes local) and suppress the resulting
 * hydration warning since the visible mismatch is intentional.
 */

export type LocalDateTimePreset =
  | "kickoffShort" // "Sat, Jun 11, 7:30 PM" — match cards, header chips
  | "kickoffLong" //  "Saturday, Jun 11, 7:30 PM" — match page header
  | "datetime" //     "Jun 12, 3:45 PM" — generic timestamp
  | "lockShort" //    same as datetime; semantic alias for lock times
  | "date" //         "Jun 12" — date only
  | "time"; //        "3:45 PM" — time only

const PRESETS: Record<LocalDateTimePreset, Intl.DateTimeFormatOptions> = {
  kickoffShort: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  kickoffLong: {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  datetime: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  lockShort: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  date: {
    month: "short",
    day: "numeric",
  },
  time: {
    hour: "numeric",
    minute: "2-digit",
  },
};

function tagFor(locale: string): string {
  // Use a full locale tag so Intl emits proper Hebrew dates (month names,
  // direction markers) rather than ambiguous fallbacks.
  return locale === "he" ? "he-IL" : "en";
}

function formatDate(
  value: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(tagFor(locale), options);
}

export default function LocalDateTime({
  value,
  preset = "datetime",
  className,
}: {
  value: Date | string | number;
  preset?: LocalDateTimePreset;
  className?: string;
}) {
  const locale = useLocale();
  const options = PRESETS[preset];
  const [text, setText] = useState(() => formatDate(value, locale, options));

  useEffect(() => {
    setText(formatDate(value, locale, options));
    // We intentionally re-run when the underlying instant or locale changes.
    // `options` is a stable lookup keyed by `preset`, so we depend on the
    // preset name instead of the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(value), locale, preset]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
