import { useLocale } from "next-intl";
import { translateTeam } from "@/lib/team-i18n";

/** Returns a function that maps an English team name to its locale-specific
 *  display string. Unknown teams pass through unchanged.
 *
 *  Works in both server and client components — `useLocale()` from next-intl 4
 *  is callable in either context. */
export function useTeamName(): (name: string) => string {
  const locale = useLocale();
  return (name: string) => translateTeam(name, locale);
}
