type KickoffValue = Date | string | number;

type MatchWithKickoff = {
  kickoff: KickoffValue;
};

export type DashboardMatchGroup<T extends MatchWithKickoff> = {
  dateKey: string;
  firstKickoff: T["kickoff"];
  matches: T[];
  showDeadline: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toMillis(value: KickoffValue): number {
  return new Date(value).getTime();
}

function localDateKey(value: KickoffValue, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function groupMatchesByLocalDate<T extends MatchWithKickoff>(
  matches: T[],
  {
    timeZone,
    now = Date.now(),
  }: {
    timeZone: string;
    now?: KickoffValue;
  }
): DashboardMatchGroup<T>[] {
  const sortedMatches = [...matches].sort(
    (left, right) => toMillis(left.kickoff) - toMillis(right.kickoff)
  );
  const groups = new Map<string, T[]>();

  for (const match of sortedMatches) {
    const dateKey = localDateKey(match.kickoff, timeZone);
    const groupMatches = groups.get(dateKey);

    if (groupMatches) {
      groupMatches.push(match);
      continue;
    }

    groups.set(dateKey, [match]);
  }

  const nowMillis = toMillis(now);

  return Array.from(groups.entries())
    .map(([dateKey, dateMatches]) => {
      const matchesByKickoff = [...dateMatches].sort(
        (left, right) => toMillis(left.kickoff) - toMillis(right.kickoff)
      );
      const firstKickoff = matchesByKickoff[0]!.kickoff;
      const firstKickoffMillis = toMillis(firstKickoff);

      return {
        dateKey,
        firstKickoff,
        matches: matchesByKickoff,
        showDeadline:
          firstKickoffMillis > nowMillis &&
          firstKickoffMillis - nowMillis <= DAY_IN_MS,
      };
    })
    .sort(
      (left, right) => toMillis(left.firstKickoff) - toMillis(right.firstKickoff)
    );
}
