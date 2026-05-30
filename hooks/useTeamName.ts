"use client";

import { useLocale } from "next-intl";
import { translateTeam } from "@/lib/team-i18n";

/** Returns a function that maps an English team name to its locale-specific
 *  display string. Unknown teams pass through unchanged. */
export function useTeamName(): (name: string) => string {
  const locale = useLocale();
  return (name: string) => translateTeam(name, locale);
}
