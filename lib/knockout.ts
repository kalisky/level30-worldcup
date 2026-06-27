// Knockout-stage helpers. Knockout matches differ from the group stage in two
// ways that matter for betting:
//   1. The "side" bet is 2-way — which team ADVANCES (win in 90', extra time,
//      or penalties). There is no draw to bet on.
//   2. The "score" bet is the legal-time score (after 90' or 120', BEFORE
//      penalties), which CAN be a draw.
// Settlement therefore needs the advancer (HOME/AWAY) stored on the match.

/** groupLabel values used for knockout rounds (matches.groupLabel is free text). */
export const KNOCKOUT_ROUNDS = ["R32", "R16", "QF", "SF", "3RD", "F"] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

const KNOCKOUT_SET = new Set<string>(KNOCKOUT_ROUNDS);

export function isKnockout(groupLabel: string): boolean {
  return KNOCKOUT_SET.has(groupLabel);
}

const ROUND_NAMES: Record<KnockoutRound, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  "3RD": "Third place",
  F: "Final",
};

export function knockoutRoundName(groupLabel: string): string {
  return ROUND_NAMES[groupLabel as KnockoutRound] ?? groupLabel;
}

/**
 * True when a knockout "team" is still a bracket placeholder rather than a real
 * nation — e.g. "3rd Group C/E", "Winner Group L", "Runner-up Group J",
 * "Winner Match 89". Such fixtures aren't bettable yet (you don't know the
 * opponent), so they're excluded from listings until the source resolves them.
 */
export function isPlaceholderTeam(name: string): boolean {
  return /\b(winner|runner[- ]?up|runners[- ]?up|loser|group|match)\b|\b\d+(st|nd|rd|th)\b|\//i.test(
    name
  );
}

/**
 * Master switch for showing knockout matches to users. Off by default so the
 * feature can ship and be previewed (local dev points at the shared DB) before
 * going live to the group. Flip KNOCKOUT_BETTING_ENABLED=true in the env to
 * release it. Does not affect the group stage.
 */
export const KNOCKOUT_BETTING_ENABLED =
  process.env.KNOCKOUT_BETTING_ENABLED === "true";
