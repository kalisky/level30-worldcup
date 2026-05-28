import { GoogleGenAI, Type } from "@google/genai";
import { SCORE_RANGE, scoreKey, type ScoreOddsCache } from "@/lib/db/schema";

const MODEL = "gemini-2.5-flash";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return new GoogleGenAI({ apiKey: key });
}

const MIN_ODDS = 1.05;
const MAX_ODDS = 100;
const MAX_DIRECTION_ODDS = 20;

function probToOdds(p: number, capOdds: number = MAX_ODDS): number {
  const minP = 1 / capOdds;
  const maxP = 1 / MIN_ODDS;
  const clamped = Math.min(Math.max(p, minP), maxP);
  return Math.round((1 / clamped) * 100) / 100;
}

function normalize(probs: number[]): number[] {
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error("AI returned non-positive probabilities.");
  return probs.map((p) => p / sum);
}

// --- Direction (1X2) odds -------------------------------------------------

export type Match1X2Odds = {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  reasoning: string;
};

export async function generate1X2Odds(input: {
  homeTeam: string;
  awayTeam: string;
  groupLabel: string;
  kickoff: Date;
}): Promise<Match1X2Odds> {
  const ai = client();
  const prompt = [
    "You are a football odds engine for a friend-group betting game (no real money) during the 2026 FIFA World Cup.",
    "Estimate the probability of each outcome in the upcoming group stage match.",
    "Be honest and well-calibrated — these are friends, not customers, so do not bake in a house margin.",
    `Match: ${input.homeTeam} vs ${input.awayTeam} (Group ${input.groupLabel}, kickoff ${input.kickoff.toISOString()})`,
    "If one or both teams are placeholders like 'Group A - Pos 2', treat them as average teams with high uncertainty.",
    "Return: homeProb, drawProb, awayProb (must sum to ~1.0), and a one-sentence reasoning.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          homeProb: { type: Type.NUMBER },
          drawProb: { type: Type.NUMBER },
          awayProb: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["homeProb", "drawProb", "awayProb", "reasoning"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  const parsed = JSON.parse(text) as {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    reasoning: string;
  };

  const [hp, dp, ap] = normalize([parsed.homeProb, parsed.drawProb, parsed.awayProb]);
  return {
    homeProb: hp,
    drawProb: dp,
    awayProb: ap,
    oddsHome: probToOdds(hp, MAX_DIRECTION_ODDS),
    oddsDraw: probToOdds(dp, MAX_DIRECTION_ODDS),
    oddsAway: probToOdds(ap, MAX_DIRECTION_ODDS),
    reasoning: parsed.reasoning,
  };
}

// --- Exact-score odds -----------------------------------------------------

/**
 * Generates odds for every exact-score cell from 0-0 through 9-9 (100 cells).
 * We ask Gemini for xG per team, then compute cell probabilities via
 * independent Poisson locally — cheaper and more consistent than asking the
 * model to emit 100 probabilities directly.
 */
export async function generateScoreOdds(input: {
  homeTeam: string;
  awayTeam: string;
  groupLabel: string;
  kickoff: Date;
  direction?: { homeProb: number; drawProb: number; awayProb: number };
}): Promise<{
  scoreOdds: ScoreOddsCache;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  reasoning: string;
}> {
  const ai = client();
  const directionLine = input.direction
    ? `For consistency, the 1X2 probabilities are approximately home ${input.direction.homeProb.toFixed(2)} / draw ${input.direction.drawProb.toFixed(2)} / away ${input.direction.awayProb.toFixed(2)}.`
    : "";

  const prompt = [
    "You are a football odds engine for a friend-group betting game (no real money) during the 2026 FIFA World Cup.",
    "Estimate expected goals (xG) per side for this group stage match.",
    "We'll convert your xG into an exact-score probability grid via independent Poisson.",
    "Be honest and well-calibrated. If teams are placeholders, assume average World Cup teams (~1.3 xG each).",
    `Match: ${input.homeTeam} vs ${input.awayTeam} (Group ${input.groupLabel}, kickoff ${input.kickoff.toISOString()})`,
    directionLine,
    "Return expectedHomeGoals (typical 0.3-3.5), expectedAwayGoals, and a one-sentence reasoning.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          expectedHomeGoals: { type: Type.NUMBER },
          expectedAwayGoals: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["expectedHomeGoals", "expectedAwayGoals", "reasoning"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  const parsed = JSON.parse(text) as {
    expectedHomeGoals: number;
    expectedAwayGoals: number;
    reasoning: string;
  };

  const xH = Math.max(0.1, Math.min(8, parsed.expectedHomeGoals));
  const xA = Math.max(0.1, Math.min(8, parsed.expectedAwayGoals));

  const scoreOdds: ScoreOddsCache = {};
  for (let h = 0; h < SCORE_RANGE; h++) {
    for (let a = 0; a < SCORE_RANGE; a++) {
      const p = poisson(h, xH) * poisson(a, xA);
      scoreOdds[scoreKey(h, a)] = probToOdds(p, MAX_ODDS);
    }
  }

  return {
    scoreOdds,
    expectedHomeGoals: xH,
    expectedAwayGoals: xA,
    reasoning: parsed.reasoning,
  };
}

function poisson(k: number, lambda: number): number {
  let logFactK = 0;
  for (let i = 2; i <= k; i++) logFactK += Math.log(i);
  const logP = -lambda + k * Math.log(lambda) - logFactK;
  return Math.exp(logP);
}

// --- Custom bet odds ------------------------------------------------------

export type CustomBetOddsResult = {
  options: { label: string; probability: number; odds: number }[];
  reasoning: string;
};

export async function generateCustomBetOdds(input: {
  matchContext?: {
    homeTeam: string;
    awayTeam: string;
    groupLabel: string;
    status: "scheduled" | "live" | "final";
    homeScore: number | null;
    awayScore: number | null;
    kickoff: Date;
  };
  title: string;
  description: string;
  optionLabels: string[];
}): Promise<CustomBetOddsResult> {
  if (input.optionLabels.length < 2) {
    throw new Error("Custom bets need at least 2 options.");
  }

  const ai = client();
  const matchLine = input.matchContext
    ? `Match: ${input.matchContext.homeTeam} vs ${input.matchContext.awayTeam} (Group ${input.matchContext.groupLabel}, status ${input.matchContext.status}, score ${input.matchContext.homeScore ?? "-"}:${input.matchContext.awayScore ?? "-"}, kickoff ${input.matchContext.kickoff.toISOString()})`
    : "No specific match — treat as a tournament-wide prop.";

  const prompt = [
    "You are a sports odds engine for a friend-group betting game (no real money, six friends total) during the 2026 FIFA World Cup.",
    "A user has proposed a custom betting line. Estimate the probability of each option.",
    "Be honest and well-calibrated — no house margin.",
    "If the line is ambiguous, vague, or impossible to evaluate, return roughly equal probabilities and say so in the reasoning.",
    "",
    matchLine,
    `Line title: ${input.title}`,
    `Description: ${input.description || "(none)"}`,
    `Options (in order): ${input.optionLabels.map((l, i) => `${i}. ${l}`).join(" | ")}`,
    "",
    "Return: probabilities[] (one per option, same order, must sum to ~1.0), and a one-sentence reasoning.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          probabilities: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
          reasoning: { type: Type.STRING },
        },
        required: ["probabilities", "reasoning"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  const parsed = JSON.parse(text) as { probabilities: number[]; reasoning: string };

  if (
    !Array.isArray(parsed.probabilities) ||
    parsed.probabilities.length !== input.optionLabels.length
  ) {
    throw new Error(
      `Gemini returned ${parsed.probabilities?.length ?? 0} probabilities, expected ${input.optionLabels.length}.`
    );
  }

  const normed = normalize(parsed.probabilities);
  return {
    options: input.optionLabels.map((label, i) => ({
      label,
      probability: normed[i],
      odds: probToOdds(normed[i], MAX_DIRECTION_ODDS),
    })),
    reasoning: parsed.reasoning,
  };
}
