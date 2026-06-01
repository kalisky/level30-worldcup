// Returns the localized title/description for a custom bet. If the bet has a
// `defaultKey` marker (set by the seeded room defaults), the translation under
// `customBet.defaults.<key>` is used so each viewer sees it in their display
// language. Otherwise the stored title/description (user-supplied at propose
// time) is returned unchanged.
type Translator = (key: string) => string;

const KNOWN_KEYS = ["tournament_winner", "top_scorer"] as const;
type DefaultKey = (typeof KNOWN_KEYS)[number];

export function customBetCopy(
  bet: {
    title: string;
    description: string;
    defaultKey: string | null;
  },
  tDefaults: Translator
): { title: string; description: string; placeholder: string | null } {
  if (bet.defaultKey && (KNOWN_KEYS as readonly string[]).includes(bet.defaultKey)) {
    const k = bet.defaultKey as DefaultKey;
    return {
      title: tDefaults(`${k}.title`),
      description: tDefaults(`${k}.description`),
      placeholder: tDefaults(`${k}.placeholder`),
    };
  }
  return { title: bet.title, description: bet.description, placeholder: null };
}
