import { TEAM_RATINGS } from "@/lib/team-ratings";

const BASELINE = 1.25;
const MAX_FIT_GOALS = 12;
const DEFAULT_TOTAL_GOALS_LINE = 2.5;

type TeamRating = {
  atk: number;
  def: number;
};

const AVERAGE_TEAM: TeamRating = {
  atk: BASELINE,
  def: BASELINE,
};

function poissonPmf(goals: number, lambda: number) {
  let logFactorial = 0;
  for (let i = 2; i <= goals; i++) logFactorial += Math.log(i);
  return Math.exp(-lambda + goals * Math.log(lambda) - logFactorial);
}

export function deriveTeamRatingsTotalGoalsPrior(
  homeTeam: string,
  awayTeam: string,
  totalGoalsLine = DEFAULT_TOTAL_GOALS_LINE
) {
  const homeRating = TEAM_RATINGS[homeTeam] ?? AVERAGE_TEAM;
  const awayRating = TEAM_RATINGS[awayTeam] ?? AVERAGE_TEAM;
  const lambdaHome = homeRating.atk * (awayRating.def / BASELINE);
  const lambdaAway = awayRating.atk * (homeRating.def / BASELINE);

  let overProb = 0;
  let totalMass = 0;

  for (let homeGoals = 0; homeGoals <= MAX_FIT_GOALS; homeGoals++) {
    const homeP = poissonPmf(homeGoals, lambdaHome);

    for (let awayGoals = 0; awayGoals <= MAX_FIT_GOALS; awayGoals++) {
      const probability = homeP * poissonPmf(awayGoals, lambdaAway);
      totalMass += probability;
      if (homeGoals + awayGoals > totalGoalsLine) {
        overProb += probability;
      }
    }
  }

  const normalization = totalMass > 0 ? totalMass : 1;
  return {
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    totalGoalsLine,
    overProb: overProb / normalization,
  };
}
