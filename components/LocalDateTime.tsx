"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

/**
 * Formats a timestamp in the user's timezone and active app locale.
 *
 * Why a dedicated component: server components render with the server's
 * timezone (UTC in production), so a plain `date.toLocaleString()` in an
 * RSC component shows the server's clock. We intentionally wait until the
 * client mounts, then format via the browser so the visible value always
 * reflects the viewer's local timezone.
 */

export type LocalDateTimePreset =
  | "kickoffShort" // "Sat, Jun 11, 7:30 PM" — match cards, header chips
  | "kickoffLong" //  "Saturday, Jun 11, 7:30 PM" — match page header
  | "datetime" //     "Jun 12, 3:45 PM" — generic timestamp
  | "lockShort" //    same as datetime; semantic alias for lock times
  | "dateWeekdayShort" // "Thu, Jun 11" — grouped dashboard headers
  | "date" //         "Jun 12" — date only
  | "time" //         "3:45 PM" — time only
  | "time24"; //      "22:00" — compact local kickoff time

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
  dateWeekdayShort: {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
  date: {
    month: "short",
    day: "numeric",
  },
  time: {
    hour: "numeric",
    minute: "2-digit",
  },
  time24: {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
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

function toDateTimeValue(value: Date | string | number): string | undefined {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function subscribeToHydration() {
  return () => {};
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
  const text = useSyncExternalStore(
    subscribeToHydration,
    () => formatDate(value, locale, options),
    () => ""
  );

  const dateTime = toDateTimeValue(value);

  return (
    <time
      dateTime={dateTime}
      className={className}
      style={text ? undefined : { visibility: "hidden" }}
    >
      {text || "\u00a0"}
    </time>
  );
}
