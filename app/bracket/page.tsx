import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";
import PublicSiteFooter from "@/components/PublicSiteFooter";
import TeamFlag from "@/components/TeamFlag";
import bracketData from "@/data/knockout_bracket.json";
import { translateTeam } from "@/lib/team-i18n";

export const metadata: Metadata = {
  title: "Bracket | Buckeclub",
  description: "Projected 2026 World Cup knockout bracket based on the current group standings.",
};

type BracketMatch = {
  match: number;
  home: string;
  away: string;
  description?: string;
};

type KnockoutBracket = {
  updated_time: string;
  round_of_32: BracketMatch[];
  round_of_16: BracketMatch[];
  quarter_finals: BracketMatch[];
  semi_finals: BracketMatch[];
  finals: BracketMatch[];
};

type MatchCardVariant = "standard" | "featured" | "compact";

const REFERENCE_SLOT_RE = /^(Winner|Loser) Match (\d+)$/i;

// The exact tournament order ensuring that adjacent matches feed directly into the next round
const R32_ORDER = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
const R16_ORDER = [89, 90, 93, 94, 91, 92, 95, 96];
const QF_ORDER = [97, 98, 99, 100];
const SF_ORDER = [101, 102];

async function loadBracket(): Promise<KnockoutBracket> {
  return bracketData as KnockoutBracket;
}

function isReferenceSlot(teamName: string) {
  return REFERENCE_SLOT_RE.test(teamName);
}

function formatReferenceChip(teamName: string) {
  const match = teamName.match(REFERENCE_SLOT_RE);
  if (!match) return teamName;
  return `${match[1].charAt(0).toUpperCase()}${match[2]}`;
}

function BracketTeamLine({
  teamName,
  locale,
  variant,
}: {
  teamName: string;
  locale: string;
  variant: MatchCardVariant;
}) {
  const referenceSlot = isReferenceSlot(teamName);
  const compact = variant === "compact";
  const featured = variant === "featured";

  return (
    <div
      className={
        "flex items-center gap-2.5 rounded-[14px] border px-2.5 py-2 " +
        (referenceSlot
          ? "border-dashed border-[#c9d6e8] bg-[#F8FBFF]"
          : featured
            ? "border-[#c8d7ef] bg-white"
            : "border-[#d7e1ef] bg-white")
      }
    >
      {referenceSlot ? (
        <span
          className={
            "inline-flex shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] font-black uppercase tracking-[0.12em] text-slate-700 " +
            (compact ? "h-7 w-7 text-[0.58rem]" : "h-8 w-8 text-[0.62rem]")
          }
        >
          {formatReferenceChip(teamName)}
        </span>
      ) : (
        <TeamFlag teamName={teamName} size={compact ? 28 : 32} />
      )}

      <span
        className={
          "min-w-0 font-black leading-tight " +
          (referenceSlot
            ? compact
              ? "text-[0.7rem] text-slate-600"
              : "text-xs text-slate-600"
            : compact
              ? "text-[0.72rem] text-[#1E3A8A]"
              : featured
                ? "text-sm text-[#153E75]"
                : "text-[0.8rem] text-[#1E3A8A]")
        }
      >
        {translateTeam(teamName, locale)}
      </span>
    </div>
  );
}

function MatchCard({
  bracketMatch,
  locale,
  matchLabel,
  variant = "standard",
}: {
  bracketMatch: BracketMatch;
  locale: string;
  matchLabel: string;
  variant?: MatchCardVariant;
}) {
  const compact = variant === "compact";
  const featured = variant === "featured";

  return (
    <article
      className={
        "rounded-[20px] border p-3 w-full " +
        (featured
          ? "border-[#9db7dc] bg-[linear-gradient(180deg,#ffffff_0%,#edf4ff_100%)] shadow-[0_18px_42px_rgba(30,58,138,0.12)]"
          : "border-[#ccd8e7] bg-[#FCFDFE] shadow-[0_10px_28px_rgba(15,23,42,0.06)]")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              "font-bold uppercase tracking-[0.18em] text-slate-500 " +
              (compact ? "text-[0.52rem]" : "text-[0.58rem]")
            }
          >
            {bracketMatch.description ?? matchLabel}
          </p>
          {bracketMatch.description && (
            <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#1D4ED8]">
              {matchLabel}
            </p>
          )}
        </div>
        <span
          className={
            "shrink-0 rounded-full bg-[#E8F0FB] px-2 py-1 font-bold uppercase tracking-[0.12em] text-[#1D4ED8] " +
            (compact ? "text-[0.55rem]" : "text-[0.58rem]")
          }
        >
          #{bracketMatch.match}
        </span>
      </div>

      <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
        <BracketTeamLine teamName={bracketMatch.home} locale={locale} variant={variant} />
        <BracketTeamLine teamName={bracketMatch.away} locale={locale} variant={variant} />
      </div>
    </article>
  );
}

function RoundColumn({
  title,
  count,
  matches,
  locale,
  widthClass,
  matchLabel,
}: {
  title: string;
  count: number;
  matches: BracketMatch[];
  locale: string;
  widthClass: string;
  matchLabel: (matchNumber: number) => string;
}) {
  return (
    <section className={`${widthClass} shrink-0 flex flex-col`}>
      <div className="mb-4 flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#1E3A8A]">
          {title}
        </h2>
        <span className="rounded-full border border-[#dbe5f2] bg-white px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-slate-500">
          {count}
        </span>
      </div>

      {/* flex-col justify-around dynamically stretches the layout without pixel collision */}
      <div className="flex-1 flex flex-col justify-around gap-4 min-h-[1400px] py-2">
        {matches.map((match) => (
          <div key={match.match} className="w-full">
            <MatchCard
              bracketMatch={match}
              locale={locale}
              matchLabel={matchLabel(match.match)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalsColumn({
  finals,
  locale,
  tbracket,
}: {
  finals: BracketMatch[];
  locale: string;
  tbracket: (key: string, values?: Record<string, string | number>) => string;
}) {
  const thirdPlace =
    finals.find((match) => match.description?.toLowerCase().includes("third")) ?? null;
  const finalMatch =
    finals.find((match) => match.description?.toLowerCase() === "final") ??
    finals.find((match) => match !== thirdPlace) ??
    null;

  return (
    <section className="w-[24rem] shrink-0 flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#1E3A8A]">
          {tbracket("finals")}
        </h2>
        <span className="rounded-full border border-[#dbe5f2] bg-white px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-slate-500">
          {finals.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[1400px]">
        <div className="w-full rounded-[28px] border border-[#b9cae4] bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef4ff_42%,#f8fbff_100%)] p-5 shadow-[0_22px_54px_rgba(30,58,138,0.12)]">
          <div className="text-center">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.24em] text-slate-500">
              {tbracket("pathToFinal")}
            </p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-[#153E75]">
              {tbracket("finals")}
            </h3>
          </div>

          {finalMatch && (
            <div className="mt-5">
              <MatchCard
                bracketMatch={finalMatch}
                locale={locale}
                matchLabel={tbracket("match", { number: finalMatch.match })}
                variant="featured"
              />
            </div>
          )}

          {thirdPlace && (
            <div className="mt-6 border-t border-[#d8e2f0] pt-5">
              <MatchCard
                bracketMatch={thirdPlace}
                locale={locale}
                matchLabel={tbracket("match", { number: thirdPlace.match })}
                variant="compact"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default async function BracketPage(props: {
  searchParams: Promise<{
    room?: string | string[] | undefined;
    from?: string | string[] | undefined;
  }>;
}) {
  const searchParams = await props.searchParams;
  const roomCode = Array.isArray(searchParams.room)
    ? searchParams.room[0]
    : searchParams.room;

  const locale = await getLocale();
  const [tnav, tbracket, tc, bracket] = await Promise.all([
    getTranslations("nav"),
    getTranslations("bracket"),
    getTranslations("common"),
    loadBracket(),
  ]);

  const updatedAt = new Date(bracket.updated_time);
  const updatedLabel = Number.isNaN(updatedAt.getTime())
    ? bracket.updated_time
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(updatedAt);

  // Sort matches beautifully according to the convergence layout rules
  const sortedR32 = [...bracket.round_of_32].sort(
    (a, b) => R32_ORDER.indexOf(a.match) - R32_ORDER.indexOf(b.match)
  );
  const sortedR16 = [...bracket.round_of_16].sort(
    (a, b) => R16_ORDER.indexOf(a.match) - R16_ORDER.indexOf(b.match)
  );
  const sortedQF = [...bracket.quarter_finals].sort(
    (a, b) => QF_ORDER.indexOf(a.match) - QF_ORDER.indexOf(b.match)
  );
  const sortedSF = [...bracket.semi_finals].sort(
    (a, b) => SF_ORDER.indexOf(a.match) - SF_ORDER.indexOf(b.match)
  );

  return (
    <>
      <AppHeader active="bracket" />
      <main className="flex-1 bg-[linear-gradient(180deg,#eef4ff_0%,#f9fbff_20%,#f4f6fb_100%)]">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {roomCode && (
            <div className="mb-5">
              <Link
                href={`/r/${roomCode}/dashboard`}
                className="inline-flex items-center gap-2 rounded-full border border-[#dbe5f2] bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:border-[#bfdbfe] hover:text-[#1E3A8A]"
              >
                <span aria-hidden="true">←</span>
                <span>
                  {tc("back")} · {tnav("dashboard")}
                </span>
              </Link>
            </div>
          )}

          <section className="overflow-hidden rounded-[34px] border border-[#bdcbe0] bg-white shadow-[0_28px_80px_rgba(30,58,138,0.12)]">
            <div className="bg-[linear-gradient(135deg,#1B2F5C_0%,#26457E_100%)] px-6 py-7 text-white sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-white/70">
                    {tbracket("pathToFinal")}
                  </p>
                  <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                    {tnav("bracket")}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78 sm:text-base">
                    {tbracket("subtitle")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {roomCode && (
                    <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/80">
                      Room {roomCode}
                    </span>
                  )}
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/80">
                    {tbracket("updatedAt", { time: updatedLabel })}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#d8e2f0] bg-[#FFFDFA] p-4 sm:p-6">
              <div className="overflow-x-auto pb-4">
                <div className="mx-auto flex w-max items-stretch justify-start gap-8 pr-8">
                  
                  <RoundColumn
                    title={tbracket("roundOf32")}
                    count={sortedR32.length}
                    matches={sortedR32}
                    locale={locale}
                    widthClass="w-[17.5rem]"
                    matchLabel={(matchNumber) => tbracket("match", { number: matchNumber })}
                  />
                  
                  <RoundColumn
                    title={tbracket("roundOf16")}
                    count={sortedR16.length}
                    matches={sortedR16}
                    locale={locale}
                    widthClass="w-[15rem]"
                    matchLabel={(matchNumber) => tbracket("match", { number: matchNumber })}
                  />
                  
                  <RoundColumn
                    title={tbracket("quarterFinals")}
                    count={sortedQF.length}
                    matches={sortedQF}
                    locale={locale}
                    widthClass="w-[14rem]"
                    matchLabel={(matchNumber) => tbracket("match", { number: matchNumber })}
                  />
                  
                  <RoundColumn
                    title={tbracket("semiFinals")}
                    count={sortedSF.length}
                    matches={sortedSF}
                    locale={locale}
                    widthClass="w-[14rem]"
                    matchLabel={(matchNumber) => tbracket("match", { number: matchNumber })}
                  />

                  <FinalsColumn
                    finals={bracket.finals}
                    locale={locale}
                    tbracket={tbracket}
                  />

                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <PublicSiteFooter />
    </>
  );
}
