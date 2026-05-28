import { GoogleGenAI } from "@google/genai";
import type { CustomBet, CustomBetOption, Match } from "@/lib/db/schema";

const MODEL = "gemini-2.5-flash";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Gemini does not allow `responseSchema` together with the Google Search
 * grounding tool, so we ask the model to emit a JSON object in its text
 * response and parse it ourselves. The model is reliable about this when the
 * prompt is explicit and ends with a JSON template.
 */
function extractJson(text: string): unknown {
  // Strip ```json fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : text).trim();
  // Find the first {...} block.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI did not return a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// --- Suggest final match score via Google Search --------------------------

export type SuggestedMatchResult = {
  found: boolean;
  homeScore?: number;
  awayScore?: number;
  reasoning: string;
};

export async function suggestMatchResult(match: Match): Promise<SuggestedMatchResult> {
  const ai = client();

  const prompt = [
    "Find the official final score of this 2026 FIFA World Cup group stage match using Google Search. Prefer authoritative sources (FIFA, BBC, ESPN, official news).",
    `Home team: ${match.homeTeam}`,
    `Away team: ${match.awayTeam}`,
    `Group: ${match.groupLabel}`,
    `Scheduled kickoff (UTC): ${new Date(match.kickoff).toISOString()}`,
    "",
    "Only report a score if you are confident the match has finished and you found an authoritative result.",
    "If the match hasn't started, is still in progress, or you can't confirm a final score, report it as not found.",
    "",
    "Respond with ONLY a JSON object (no commentary) in exactly this shape:",
    `{`,
    `  "found": boolean,`,
    `  "homeScore": number (only if found),`,
    `  "awayScore": number (only if found),`,
    `  "reasoning": "one sentence citing the source/date"`,
    `}`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) {
    return { found: false, reasoning: "Gemini returned an empty response." };
  }

  try {
    const parsed = extractJson(text) as SuggestedMatchResult;
    return parsed;
  } catch (e) {
    return {
      found: false,
      reasoning:
        "Couldn't parse AI response. Raw output: " + text.slice(0, 200),
    };
  }
}

// --- Suggest custom bet winner --------------------------------------------

export type SuggestedCustomBetWinner = {
  determinable: boolean;
  winningOptionIdx?: number;
  reasoning: string;
};

export async function suggestCustomBetWinner(input: {
  bet: CustomBet;
  match: Match | null;
}): Promise<SuggestedCustomBetWinner> {
  const ai = client();

  const options = input.bet.options as CustomBetOption[];

  const matchContext = input.match
    ? [
        `Match: ${input.match.homeTeam} vs ${input.match.awayTeam} (Group ${input.match.groupLabel}, kickoff ${new Date(input.match.kickoff).toISOString()}).`,
        input.match.status === "final"
          ? `Final score: ${input.match.homeTeam} ${input.match.homeScore} – ${input.match.awayScore} ${input.match.awayTeam}.`
          : `Match status: ${input.match.status}.`,
      ].join(" ")
    : "No specific match associated.";

  const prompt = [
    "Determine which option of a custom betting line actually happened. Use Google Search if needed to find details beyond the final score (e.g., first scorer, yellow cards, who scored first half).",
    matchContext,
    "",
    `Betting line: ${input.bet.title}`,
    `Description: ${input.bet.description || "(none)"}`,
    `Options:`,
    ...options.map((o, i) => `  ${i}. ${o.label}`),
    "",
    "Respond with ONLY a JSON object (no commentary) in exactly this shape:",
    `{`,
    `  "determinable": boolean,`,
    `  "winningOptionIdx": number (zero-based index, only if determinable),`,
    `  "reasoning": "one sentence explaining the choice"`,
    `}`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) {
    return { determinable: false, reasoning: "Gemini returned an empty response." };
  }

  try {
    return extractJson(text) as SuggestedCustomBetWinner;
  } catch (e) {
    return {
      determinable: false,
      reasoning:
        "Couldn't parse AI response. Raw output: " + text.slice(0, 200),
    };
  }
}
