import { scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

const MIN_ODDS = 1.05;
const MAX_ODDS = 100;
const MAX_OUTPUT_SCORE = 9;
const MAX_FIT_GOALS = 12;

export type PoissonMarketInputs = {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  totalGoalsLine: number;
  overProb: number;
};

export type FittedPoissonOdds = {
  lambdaHome: number;
  lambdaAway: number;
  scoreOdds: ScoreOddsCache;
  model: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    overProb: number;
  };
};

type OutcomeSummary = {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  overProb: number;
  scoreProbs: ScoreOddsCache;
};

function poissonPmf(goals: number, lambda: number) {
  let logFactorial = 0;
  for (let i = 2; i <= goals; i++) logFactorial += Math.log(i);
  return Math.exp(-lambda + goals * Math.log(lambda) - logFactorial);
}

function probabilityToOdds(probability: number) {
  const clamped = Math.min(Math.max(probability, 1 / MAX_ODDS), 1 / MIN_ODDS);
  return Math.round((1 / clamped) * 100) / 100;
}

function evaluatePoissonModel(
  lambdaHome: number,
  lambdaAway: number,
  totalGoalsLine: number
): OutcomeSummary {
  let homeProb = 0;
  let drawProb = 0;
  let awayProb = 0;
  let overProb = 0;
  let totalMass = 0;
  const scoreProbs: ScoreOddsCache = {};

  for (let homeGoals = 0; homeGoals <= MAX_FIT_GOALS; homeGoals++) {
    const homeP = poissonPmf(homeGoals, lambdaHome);

    for (let awayGoals = 0; awayGoals <= MAX_FIT_GOALS; awayGoals++) {
      const awayP = poissonPmf(awayGoals, lambdaAway);
      const probability = homeP * awayP;
      totalMass += probability;

      if (homeGoals > awayGoals) homeProb += probability;
      else if (homeGoals === awayGoals) drawProb += probability;
      else awayProb += probability;

      if (homeGoals + awayGoals > totalGoalsLine) {
        overProb += probability;
      }

      if (homeGoals <= MAX_OUTPUT_SCORE && awayGoals <= MAX_OUTPUT_SCORE) {
        scoreProbs[scoreKey(homeGoals, awayGoals)] = probability;
      }
    }
  }

  const normalization = totalMass > 0 ? totalMass : 1;
  const normalizedScores: ScoreOddsCache = {};
  for (const [key, probability] of Object.entries(scoreProbs)) {
    normalizedScores[key] = probability / normalization;
  }

  return {
    homeProb: homeProb / normalization,
    drawProb: drawProb / normalization,
    awayProb: awayProb / normalization,
    overProb: overProb / normalization,
    scoreProbs: normalizedScores,
  };
}

function scoreFit(
  model: OutcomeSummary,
  market: PoissonMarketInputs
) {
  return (
    (model.homeProb - market.homeProb) ** 2 +
    (model.drawProb - market.drawProb) ** 2 +
    (model.awayProb - market.awayProb) ** 2 +
    1.25 * (model.overProb - market.overProb) ** 2
  );
}

export function fitPoissonOddsFromMarketInputs(
  market: PoissonMarketInputs
): FittedPoissonOdds {
  let best = {
    lambdaHome: 1.3,
    lambdaAway: 1.1,
    score: Number.POSITIVE_INFINITY,
    model: evaluatePoissonModel(1.3, 1.1, market.totalGoalsLine),
  };

  for (let lambdaHome = 0.2; lambdaHome <= 3.8; lambdaHome += 0.1) {
    for (let lambdaAway = 0.2; lambdaAway <= 3.8; lambdaAway += 0.1) {
      const model = evaluatePoissonModel(lambdaHome, lambdaAway, market.totalGoalsLine);
      const fit = scoreFit(model, market);
      if (fit < best.score) {
        best = {
          lambdaHome,
          lambdaAway,
          score: fit,
          model,
        };
      }
    }
  }

  for (
    let lambdaHome = Math.max(0.1, best.lambdaHome - 0.2);
    lambdaHome <= best.lambdaHome + 0.2;
    lambdaHome += 0.02
  ) {
    for (
      let lambdaAway = Math.max(0.1, best.lambdaAway - 0.2);
      lambdaAway <= best.lambdaAway + 0.2;
      lambdaAway += 0.02
    ) {
      const model = evaluatePoissonModel(lambdaHome, lambdaAway, market.totalGoalsLine);
      const fit = scoreFit(model, market);
      if (fit < best.score) {
        best = {
          lambdaHome,
          lambdaAway,
          score: fit,
          model,
        };
      }
    }
  }

  const scoreOdds: ScoreOddsCache = {};
  for (const [key, probability] of Object.entries(best.model.scoreProbs)) {
    scoreOdds[key] = probabilityToOdds(probability);
  }

  return {
    lambdaHome: Math.round(best.lambdaHome * 100) / 100,
    lambdaAway: Math.round(best.lambdaAway * 100) / 100,
    scoreOdds,
    model: {
      homeProb: best.model.homeProb,
      drawProb: best.model.drawProb,
      awayProb: best.model.awayProb,
      overProb: best.model.overProb,
    },
  };
}
