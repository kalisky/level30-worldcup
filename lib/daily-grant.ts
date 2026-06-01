const DAILY_GRANT_FRACTION = 10; // 1/10th of starting chips
const DAILY_GRANT_MIN_HOURS = 20; // user can collect again after ~20h

export function getDailyGrantAmount(startingChips: number) {
  return Math.floor(startingChips / DAILY_GRANT_FRACTION);
}

export function isDailyGrantEligible(
  startingChips: number,
  lastDailyGrantAt: Date | null,
  now: Date = new Date()
) {
  const grant = getDailyGrantAmount(startingChips);
  if (grant <= 0) return false;
  if (!lastDailyGrantAt) return true;

  const nextEligibleAt =
    lastDailyGrantAt.getTime() + DAILY_GRANT_MIN_HOURS * 60 * 60 * 1000;

  return nextEligibleAt <= now.getTime();
}

export { DAILY_GRANT_FRACTION, DAILY_GRANT_MIN_HOURS };
