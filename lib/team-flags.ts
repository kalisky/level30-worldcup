const TEAM_FLAG_CODES: Record<string, string> = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  bahrain: "bh",
  belgium: "be",
  bolivia: "bo",
  brazil: "br",
  bulgaria: "bg",
  cameroon: "cm",
  canada: "ca",
  chile: "cl",
  china: "cn",
  colombia: "co",
  "costa rica": "cr",
  croatia: "hr",
  curacao: "cw",
  czechia: "cz",
  "czech republic": "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  "el salvador": "sv",
  france: "fr",
  germany: "de",
  ghana: "gh",
  greece: "gr",
  guatemala: "gt",
  haiti: "ht",
  honduras: "hn",
  hungary: "hu",
  india: "in",
  iran: "ir",
  "ir iran": "ir",
  iraq: "iq",
  ireland: "ie",
  israel: "il",
  italy: "it",
  "cote d ivoire": "ci",
  "ivory coast": "ci",
  jamaica: "jm",
  japan: "jp",
  jordan: "jo",
  korea: "kr",
  "korea republic": "kr",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  norway: "no",
  oman: "om",
  panama: "pa",
  paraguay: "py",
  peru: "pe",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  romania: "ro",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  slovakia: "sk",
  slovenia: "si",
  "south africa": "za",
  "south korea": "kr",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  syria: "sy",
  tunisia: "tn",
  turkey: "tr",
  turkiye: "tr",
  usa: "us",
  "united states": "us",
  uruguay: "uy",
  uzbekistan: "uz",
  venezuela: "ve",
  "united arab emirates": "ae",
  wales: "gb-wls",
};

const TEAM_ABBREVIATIONS: Record<string, string> = {
  algeria: "ALG",
  argentina: "ARG",
  australia: "AUS",
  austria: "AUT",
  bahrain: "BHR",
  belgium: "BEL",
  bolivia: "BOL",
  brazil: "BRA",
  bulgaria: "BUL",
  cameroon: "CMR",
  canada: "CAN",
  chile: "CHI",
  china: "CHN",
  colombia: "COL",
  "costa rica": "CRC",
  croatia: "CRO",
  curacao: "CUW",
  czechia: "CZE",
  "czech republic": "CZE",
  denmark: "DEN",
  ecuador: "ECU",
  egypt: "EGY",
  england: "ENG",
  "el salvador": "SLV",
  france: "FRA",
  germany: "GER",
  ghana: "GHA",
  greece: "GRE",
  guatemala: "GUA",
  haiti: "HAI",
  honduras: "HON",
  hungary: "HUN",
  india: "IND",
  iran: "IRN",
  "ir iran": "IRN",
  iraq: "IRQ",
  ireland: "IRL",
  israel: "ISR",
  italy: "ITA",
  "cote d ivoire": "CIV",
  "ivory coast": "CIV",
  jamaica: "JAM",
  japan: "JPN",
  jordan: "JOR",
  korea: "KOR",
  "korea republic": "KOR",
  mexico: "MEX",
  morocco: "MAR",
  netherlands: "NED",
  "new zealand": "NZL",
  nigeria: "NGA",
  norway: "NOR",
  oman: "OMA",
  panama: "PAN",
  paraguay: "PAR",
  peru: "PER",
  poland: "POL",
  portugal: "POR",
  qatar: "QAT",
  romania: "ROU",
  "saudi arabia": "KSA",
  scotland: "SCO",
  senegal: "SEN",
  serbia: "SRB",
  slovakia: "SVK",
  slovenia: "SVN",
  "south africa": "RSA",
  "south korea": "KOR",
  spain: "ESP",
  sweden: "SWE",
  switzerland: "SUI",
  syria: "SYR",
  tunisia: "TUN",
  turkey: "TUR",
  turkiye: "TUR",
  usa: "USA",
  "united states": "USA",
  uruguay: "URU",
  uzbekistan: "UZB",
  venezuela: "VEN",
  "united arab emirates": "UAE",
  wales: "WAL",
};

function normalizeTeamName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getTeamFlagCode(teamName: string): string | null {
  const normalized = normalizeTeamName(teamName);
  return TEAM_FLAG_CODES[normalized] ?? null;
}

function getFlagEmojiFromCode(code: string): string | null {
  if (!/^[a-z]{2}$/i.test(code)) {
    return null;
  }

  const codePoints = code
    .toUpperCase()
    .split("")
    .map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65);

  return String.fromCodePoint(...codePoints);
}

export function getTeamFlagEmoji(teamName: string): string | null {
  const flagCode = getTeamFlagCode(teamName);
  if (!flagCode) {
    return null;
  }

  return getFlagEmojiFromCode(flagCode);
}

export function getTeamAbbreviation(teamName: string): string {
  const placeholder = teamName.match(/group\s+([a-z])\s*-\s*pos\s*(\d+)/i);
  if (placeholder) {
    return `${placeholder[1].toUpperCase()}${placeholder[2]}`;
  }

  const normalized = normalizeTeamName(teamName);
  if (!normalized) return "WCB";

  const knownAbbreviation = TEAM_ABBREVIATIONS[normalized];
  if (knownAbbreviation) return knownAbbreviation;

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }

  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getTeamFallbackMark(teamName: string): string {
  const placeholder = teamName.match(/group\s+([a-z])\s*-\s*pos\s*(\d+)/i);
  if (placeholder) {
    return `${placeholder[1].toUpperCase()}${placeholder[2]}`;
  }

  const normalized = normalizeTeamName(teamName);
  if (!normalized) return "WC";
  if (normalized.length <= 3) return normalized.toUpperCase();

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
