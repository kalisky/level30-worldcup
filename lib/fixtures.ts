// 2026 FIFA World Cup — 48 teams, 12 groups (A–L), 4 teams each.
// Group stage: 72 matches across ~16 days (June 11 – June 27, 2026).
//
// Team placeholders are used by default. After the FIFA draw is confirmed in
// your local copy, edit the `GROUPS` array below (or rename teams via the
// admin UI once the room is created) and re-run `npm run seed`.

export type GroupLabel =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export const GROUP_LABELS: GroupLabel[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

// Each group: 4 team slots. Replace placeholders with real team names.
export const GROUPS: Record<GroupLabel, [string, string, string, string]> = {
  A: ["Mexico", "Group A - Pos 2", "Group A - Pos 3", "Group A - Pos 4"],
  B: ["Canada", "Group B - Pos 2", "Group B - Pos 3", "Group B - Pos 4"],
  C: ["Group C - Pos 1", "Group C - Pos 2", "Group C - Pos 3", "Group C - Pos 4"],
  D: ["USA", "Group D - Pos 2", "Group D - Pos 3", "Group D - Pos 4"],
  E: ["Group E - Pos 1", "Group E - Pos 2", "Group E - Pos 3", "Group E - Pos 4"],
  F: ["Group F - Pos 1", "Group F - Pos 2", "Group F - Pos 3", "Group F - Pos 4"],
  G: ["Group G - Pos 1", "Group G - Pos 2", "Group G - Pos 3", "Group G - Pos 4"],
  H: ["Group H - Pos 1", "Group H - Pos 2", "Group H - Pos 3", "Group H - Pos 4"],
  I: ["Group I - Pos 1", "Group I - Pos 2", "Group I - Pos 3", "Group I - Pos 4"],
  J: ["Group J - Pos 1", "Group J - Pos 2", "Group J - Pos 3", "Group J - Pos 4"],
  K: ["Group K - Pos 1", "Group K - Pos 2", "Group K - Pos 3", "Group K - Pos 4"],
  L: ["Group L - Pos 1", "Group L - Pos 2", "Group L - Pos 3", "Group L - Pos 4"],
};

// Standard round-robin pairings (1-indexed positions within a group).
type Pair = [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
const MATCHDAY_PAIRS: Record<1 | 2 | 3, [Pair, Pair]> = {
  1: [[1, 2], [3, 4]],
  2: [[1, 3], [2, 4]],
  3: [[1, 4], [2, 3]],
};

// Kickoff slots (UTC). Group stage runs June 11 – 27, 2026.
// We schedule each group's three matchdays in successive 5–6 day windows so
// matchday 3 of each group falls on the same day for fairness.
// Times are approximate — admin can edit per match via the UI.
function isoUtc(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(Date.UTC(y, m - 1, d, h, min)).toISOString();
}

// Matchday 1: June 11–17. Each group gets one day (12 groups × 1 day = 12 days).
// We'll cram 4 groups per day across 3 days to fit the actual FIFA cadence:
//   - June 11: Group A (opening day, 1 match featured)
//   - June 12: Groups B, C
//   - June 13: Groups D, E
//   - June 14: Groups F, G
//   - June 15: Groups H, I
//   - June 16: Groups J, K
//   - June 17: Group L
// Matchday 2 follows the same group order June 17–23.
// Matchday 3 ("simultaneous" final matchday per group): June 24–27, two groups
// per day with simultaneous kickoffs to prevent collusion.

const MD1_GROUP_DATES: Record<GroupLabel, [number, number, number]> = {
  A: [2026, 6, 11], B: [2026, 6, 12], C: [2026, 6, 12],
  D: [2026, 6, 13], E: [2026, 6, 13], F: [2026, 6, 14],
  G: [2026, 6, 14], H: [2026, 6, 15], I: [2026, 6, 15],
  J: [2026, 6, 16], K: [2026, 6, 16], L: [2026, 6, 17],
};
const MD2_GROUP_DATES: Record<GroupLabel, [number, number, number]> = {
  A: [2026, 6, 17], B: [2026, 6, 18], C: [2026, 6, 18],
  D: [2026, 6, 19], E: [2026, 6, 19], F: [2026, 6, 20],
  G: [2026, 6, 20], H: [2026, 6, 21], I: [2026, 6, 21],
  J: [2026, 6, 22], K: [2026, 6, 22], L: [2026, 6, 23],
};
// Matchday 3: simultaneous within each group; spread across June 24–27.
const MD3_GROUP_DATES: Record<GroupLabel, [number, number, number]> = {
  A: [2026, 6, 24], B: [2026, 6, 24], C: [2026, 6, 25],
  D: [2026, 6, 25], E: [2026, 6, 25], F: [2026, 6, 26],
  G: [2026, 6, 26], H: [2026, 6, 26], I: [2026, 6, 27],
  J: [2026, 6, 27], K: [2026, 6, 27], L: [2026, 6, 27],
};

// Two kickoff slots per matchday for matchdays 1 & 2 (12:00 / 18:00 UTC),
// simultaneous slot for matchday 3 (20:00 UTC).
const MD1_SLOTS: [number, number][] = [[18, 0], [21, 0]];
const MD2_SLOTS: [number, number][] = [[18, 0], [21, 0]];
const MD3_SLOTS: [number, number][] = [[20, 0], [20, 0]];

export type FixtureRow = {
  groupLabel: GroupLabel;
  matchday: 1 | 2 | 3;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO
};

export function buildGroupStageFixtures(): FixtureRow[] {
  const rows: FixtureRow[] = [];

  for (const g of GROUP_LABELS) {
    const teams = GROUPS[g];

    ([1, 2, 3] as const).forEach((md) => {
      const [pair1, pair2] = MATCHDAY_PAIRS[md];
      const date =
        md === 1 ? MD1_GROUP_DATES[g] :
        md === 2 ? MD2_GROUP_DATES[g] :
        MD3_GROUP_DATES[g];
      const slots = md === 1 ? MD1_SLOTS : md === 2 ? MD2_SLOTS : MD3_SLOTS;

      const [y, mo, d] = date;
      const [h1, min1] = slots[0];
      const [h2, min2] = slots[1];

      rows.push({
        groupLabel: g,
        matchday: md,
        homeTeam: teams[pair1[0] - 1],
        awayTeam: teams[pair1[1] - 1],
        kickoff: isoUtc(y, mo, d, h1, min1),
      });
      rows.push({
        groupLabel: g,
        matchday: md,
        homeTeam: teams[pair2[0] - 1],
        awayTeam: teams[pair2[1] - 1],
        kickoff: isoUtc(y, mo, d, h2, min2),
      });
    });
  }

  return rows;
}
