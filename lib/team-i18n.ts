/**
 * Country / team name translations for the 48 World Cup 2026 participants.
 * Keys are the canonical English names as stored in the `matches` table
 * (and produced by `scripts/fetch-real-fixtures.ts`).
 *
 * `translateTeam(name, locale)` falls back to the original (verbatim) name
 * for any team not in this table, so adding R16/QF/etc. teams later won't
 * break the UI — they'll just render in their stored language until they're
 * added here.
 */

type TeamTranslations = { en: string; he: string };

export const TEAM_NAMES: Record<string, TeamTranslations> = {
  // Group A
  Mexico: { en: "Mexico", he: "מקסיקו" },
  "South Africa": { en: "South Africa", he: "דרום אפריקה" },
  "South Korea": { en: "South Korea", he: "דרום קוריאה" },
  Czechia: { en: "Czechia", he: "צ׳כיה" },
  // Group B
  Canada: { en: "Canada", he: "קנדה" },
  "Bosnia and Herzegovina": {
    en: "Bosnia and Herzegovina",
    he: "בוסניה והרצגובינה",
  },
  "Bosnia & Herzegovina": {
    en: "Bosnia and Herzegovina",
    he: "בוסניה והרצגובינה",
  },
  "Bosnia & Herzogovina": {
    en: "Bosnia and Herzegovina",
    he: "בוסניה והרצגובינה",
  },
  Qatar: { en: "Qatar", he: "קטאר" },
  Switzerland: { en: "Switzerland", he: "שווייץ" },
  // Group C
  Brazil: { en: "Brazil", he: "ברזיל" },
  Morocco: { en: "Morocco", he: "מרוקו" },
  Haiti: { en: "Haiti", he: "האיטי" },
  Scotland: { en: "Scotland", he: "סקוטלנד" },
  // Group D
  USA: { en: "USA", he: "ארה״ב" },
  Paraguay: { en: "Paraguay", he: "פרגוואי" },
  Australia: { en: "Australia", he: "אוסטרליה" },
  Turkiye: { en: "Turkiye", he: "טורקיה" },
  // Group E
  Germany: { en: "Germany", he: "גרמניה" },
  "Curaçao": { en: "Curaçao", he: "קוראסאו" },
  "Ivory Coast": { en: "Ivory Coast", he: "חוף השנהב" },
  Ecuador: { en: "Ecuador", he: "אקוודור" },
  // Group F
  Netherlands: { en: "Netherlands", he: "הולנד" },
  Japan: { en: "Japan", he: "יפן" },
  Sweden: { en: "Sweden", he: "שוודיה" },
  Tunisia: { en: "Tunisia", he: "תוניסיה" },
  // Group G
  Belgium: { en: "Belgium", he: "בלגיה" },
  Egypt: { en: "Egypt", he: "מצרים" },
  "IR Iran": { en: "Iran", he: "איראן" },
  "New Zealand": { en: "New Zealand", he: "ניו זילנד" },
  // Group H
  Spain: { en: "Spain", he: "ספרד" },
  "Cabo Verde": { en: "Cabo Verde", he: "כף ורדה" },
  "Saudi Arabia": { en: "Saudi Arabia", he: "ערב הסעודית" },
  Uruguay: { en: "Uruguay", he: "אורוגוואי" },
  // Group I
  France: { en: "France", he: "צרפת" },
  Senegal: { en: "Senegal", he: "סנגל" },
  Iraq: { en: "Iraq", he: "עיראק" },
  Norway: { en: "Norway", he: "נורווגיה" },
  // Group J
  Argentina: { en: "Argentina", he: "ארגנטינה" },
  Algeria: { en: "Algeria", he: "אלג׳יריה" },
  Austria: { en: "Austria", he: "אוסטריה" },
  Jordan: { en: "Jordan", he: "ירדן" },
  // Group K
  Portugal: { en: "Portugal", he: "פורטוגל" },
  "DR Congo": { en: "DR Congo", he: "הרפובליקה הדמוקרטית של קונגו" },
  Uzbekistan: { en: "Uzbekistan", he: "אוזבקיסטן" },
  Colombia: { en: "Colombia", he: "קולומביה" },
  // Group L
  England: { en: "England", he: "אנגליה" },
  Croatia: { en: "Croatia", he: "קרואטיה" },
  Ghana: { en: "Ghana", he: "גאנה" },
  Panama: { en: "Panama", he: "פנמה" },
};

export function translateTeam(name: string, locale: string): string {
  const entry = TEAM_NAMES[name];
  if (!entry) return name;
  return locale === "he" ? entry.he : entry.en;
}
