// Hand-calibrated by Claude Opus 4.7 in-conversation on 2026-05-28 based on
// training data + FIFA rankings + recent form through January 2026.
//
// Format: { atk, def } where the baseline is 1.25 — an average WC team scores
// 1.25 expected goals per game and concedes 1.25. Higher atk = stronger
// offense, LOWER def = stronger defense. Used to bootstrap all 72 group-stage
// matches without burning Gemini API calls.
//
// Edit any rating you disagree with and re-run `npm run odds:compute`.

export type TeamRating = { atk: number; def: number };

export const TEAM_RATINGS: Record<string, TeamRating> = {
  // Top tier — calibrated to May 2026 bookmaker outright odds.
  // Spain & France co-favorites (~+500), England (+650), Brazil (+800),
  // Argentina (+850), Germany (+1400).
  Spain: { atk: 1.90, def: 0.85 },            // Euro 2024 champion, co-favorite
  France: { atk: 1.90, def: 0.85 },           // co-favorite
  England: { atk: 1.80, def: 0.90 },
  Brazil: { atk: 1.80, def: 0.95 },           // Ancelotti era
  Argentina: { atk: 1.75, def: 0.90 },        // defending champion, aging Messi
  Portugal: { atk: 1.70, def: 1.00 },
  Netherlands: { atk: 1.65, def: 1.00 },
  Germany: { atk: 1.55, def: 1.05 },
  Belgium: { atk: 1.50, def: 1.05 },          // aging golden generation

  // Strong tier
  Croatia: { atk: 1.45, def: 1.00 },
  Uruguay: { atk: 1.55, def: 1.05 },
  Morocco: { atk: 1.40, def: 1.00 },          // 4th in 2022
  Colombia: { atk: 1.50, def: 1.05 },         // 2024 Copa finalist
  Switzerland: { atk: 1.40, def: 1.05 },
  Mexico: { atk: 1.40, def: 1.05 },           // host
  USA: { atk: 1.35, def: 1.10 },              // host
  Norway: { atk: 1.55, def: 1.10 },           // Haaland; weaker defensively
  Senegal: { atk: 1.40, def: 1.05 },
  Japan: { atk: 1.40, def: 1.00 },            // rising
  Ecuador: { atk: 1.30, def: 1.05 },

  // Mid tier
  Sweden: { atk: 1.30, def: 1.05 },
  "South Korea": { atk: 1.30, def: 1.10 },    // Son, Lee, etc.
  Australia: { atk: 1.20, def: 1.10 },
  "IR Iran": { atk: 1.20, def: 1.10 },
  Algeria: { atk: 1.30, def: 1.15 },
  Tunisia: { atk: 1.10, def: 1.10 },
  Egypt: { atk: 1.30, def: 1.10 },            // Salah
  Canada: { atk: 1.25, def: 1.15 },           // host
  Turkiye: { atk: 1.30, def: 1.15 },
  Austria: { atk: 1.30, def: 1.15 },
  Scotland: { atk: 1.20, def: 1.15 },
  Czechia: { atk: 1.20, def: 1.15 },
  Paraguay: { atk: 1.20, def: 1.15 },
  "Bosnia and Herzegovina": { atk: 1.25, def: 1.20 },
  "Ivory Coast": { atk: 1.30, def: 1.20 },    // AFCON champion
  "Saudi Arabia": { atk: 1.15, def: 1.15 },

  // Lower tier
  "DR Congo": { atk: 1.20, def: 1.25 },
  Qatar: { atk: 1.10, def: 1.30 },
  Iraq: { atk: 1.05, def: 1.30 },
  Uzbekistan: { atk: 1.15, def: 1.25 },
  Ghana: { atk: 1.20, def: 1.30 },
  "Cabo Verde": { atk: 1.05, def: 1.30 },
  "South Africa": { atk: 1.10, def: 1.25 },
  "New Zealand": { atk: 1.00, def: 1.30 },
  Jordan: { atk: 1.05, def: 1.35 },
  Panama: { atk: 1.00, def: 1.35 },
  "Curaçao": { atk: 0.95, def: 1.40 },
  Haiti: { atk: 0.95, def: 1.40 },
};
