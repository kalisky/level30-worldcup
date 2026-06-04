import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";
import CreateRoomLauncher from "@/components/CreateRoomLauncher";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import SubmitButton from "@/components/SubmitButton";
import { joinRoomByCode } from "@/lib/actions/rooms";
import { getAuthenticatedUser, profileRedirectPath } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";

const LP_PATH = "/bets-to-make-with-friends-app";
const baseUrl = getPublicBaseUrl();
const canonicalUrl = baseUrl ? new URL(LP_PATH, baseUrl).toString() : undefined;

export const metadata: Metadata = {
  title: "Bets to Make With Friends App | Buckeclub",
  description:
    "Buckeclub is a bets to make with friends app built for custom bets, with special World Cup 2026 support and match odds fetched from Polymarket.",
  keywords: [
    "bets to make with friends app",
    "bet app for friends",
    "custom bets with friends",
    "friendly bets app",
    "sports bets with friends",
    "world cup prediction app",
    "polymarket odds",
    "world cup 2026 bets",
  ],
  alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
  openGraph: {
    title: "Bets to Make With Friends App | Buckeclub",
    description:
      "Create a private room for custom bets, use special World Cup 2026 support, and see supported match odds from Polymarket.",
    type: "website",
    url: canonicalUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Bets to Make With Friends App | Buckeclub",
    description:
      "Custom bets with friends, special World Cup 2026 support, and match odds sourced from Polymarket.",
  },
};

type ContentCard = {
  title: string;
  body: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

function FriendsLandingPreview({
  label,
  title,
  meta,
  statusLabel,
  lockedLabel,
  pick,
  scoreLabel,
  score,
  customLabel,
  custom,
  leaderLabel,
  leaderName,
  leaderChips,
}: {
  label: string;
  title: string;
  meta: string;
  statusLabel: string;
  lockedLabel: string;
  pick: string;
  scoreLabel: string;
  score: string;
  customLabel: string;
  custom: string;
  leaderLabel: string;
  leaderName: string;
  leaderChips: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-[#dbe5f2] bg-[linear-gradient(155deg,#E0EEFF_0%,#F8FBFF_48%,#FFF4EB_100%)] p-6 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
      <div className="absolute -right-14 top-6 h-36 w-36 rounded-full bg-[#BFDBFE]/60 blur-3xl" />
      <div className="absolute -left-10 bottom-4 h-28 w-28 rounded-full bg-[#FDBA74]/40 blur-3xl" />

      <div className="relative">
        <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8] backdrop-blur">
          {label}
        </span>

        <div className="mt-4 rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(30,58,138,0.08)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#1E3A8A]">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{meta}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#059669]">
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-[#dbe5f2] bg-[#F8FBFF] px-4 py-3">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-slate-400">
                {lockedLabel}
              </div>
              <div className="mt-1 text-sm font-semibold text-[#1E3A8A]">{pick}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#dbe5f2] bg-white px-4 py-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-slate-400">
                  {scoreLabel}
                </div>
                <div className="mt-1 text-sm font-semibold text-[#1E3A8A]">{score}</div>
              </div>
              <div className="rounded-[22px] border border-[#dbe5f2] bg-white px-4 py-3">
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-slate-400">
                  {customLabel}
                </div>
                <div className="mt-1 text-sm font-semibold text-[#1E3A8A]">{custom}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-4 ml-auto max-w-[16rem] rounded-[24px] border border-[#dbe5f2] bg-[#1E3A8A] px-4 py-4 text-white shadow-[0_16px_36px_rgba(30,58,138,0.20)]">
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#BFDBFE]">
            {leaderLabel}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-lg font-black tracking-tight">{leaderName}</span>
            <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-bold">
              1
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-[#DBEAFE]">{leaderChips}</div>
        </div>
      </div>
    </section>
  );
}

export default async function FriendsBetsLandingPage() {
  const authUser = await getAuthenticatedUser();
  if (authUser && !authUser.displayName) {
    redirect(profileRedirectPath(LP_PATH));
  }

  const t = await getTranslations("friendsLanding");
  const tl = await getTranslations("landing");

  const featureCards = t.raw("featureCards") as ContentCard[];
  const ideaCards = t.raw("ideaCards") as ContentCard[];
  const steps = t.raw("steps") as ContentCard[];
  const faq = t.raw("faq") as FaqItem[];

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Buckeclub",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description: t("subtitle"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(224,238,255,0.75),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,237,213,0.9),transparent_35%),#F8FBFF] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[34px] border border-[#dbe5f2] bg-white p-7 shadow-[0_24px_70px_rgba(30,58,138,0.10)] sm:p-8">
              <span className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#EA580C]">
                {t("eyebrow")}
              </span>

              <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-[#1E3A8A] sm:text-5xl">
                {t("title")}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {t("subtitle")}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  t("benefitPrivate"),
                  t("benefitChips"),
                  t("benefitLive"),
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-1.5 text-sm font-semibold text-[#1E3A8A]"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 rounded-[28px] border border-[#dbe5f2] bg-[#F8FBFF] p-5">
                {authUser ? (
                  <>
                    <h2 className="text-2xl font-black tracking-tight text-[#1E3A8A]">
                      {t("signedInTitle")}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {t("signedInSubtitle")}
                    </p>

                    <div className="mt-5">
                      <CreateRoomLauncher
                        creatorName={authUser.displayName!}
                        variant="hero"
                      />
                    </div>

                    <div className="relative my-6 flex items-center">
                      <div className="flex-grow border-t border-[#dbe5f2]" />
                      <span className="mx-3 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-slate-500">
                        {tl("or")}
                      </span>
                      <div className="flex-grow border-t border-[#dbe5f2]" />
                    </div>

                    <form
                      action={joinRoomByCode}
                      className="space-y-3 rounded-[24px] border border-[#dbe5f2] bg-white p-5"
                    >
                      <label
                        htmlFor="friends-landing-room-code"
                        className="block text-sm font-bold text-[#1E3A8A]"
                      >
                        {tl("joinRoom")}
                      </label>
                      <input
                        id="friends-landing-room-code"
                        name="code"
                        type="text"
                        placeholder="ABCDE"
                        autoCapitalize="characters"
                        autoComplete="off"
                        required
                        dir="ltr"
                        className="w-full rounded-2xl border border-[#cdd9ea] bg-white px-4 py-3 text-lg font-semibold tracking-[0.35em] uppercase text-[#1E3A8A] placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:border-[#3B82F6] focus:outline-none"
                      />
                      <SubmitButton
                        pendingLabel={tl("joinRoomPending")}
                        className="w-full rounded-2xl border border-[#cdd9ea] bg-white px-4 py-3 font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:cursor-progress"
                      >
                        {tl("joinRoomCta")}
                      </SubmitButton>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-black tracking-tight text-[#1E3A8A]">
                      {t("signedOutTitle")}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {t("signedOutSubtitle")}
                    </p>
                    <div className="mt-5">
                      <GoogleLoginButton
                        redirectTo={LP_PATH}
                        label={t("signedOutCta")}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <FriendsLandingPreview
              label={t("previewLabel")}
              title={t("previewTitle")}
              meta={t("previewMeta")}
              statusLabel={t("previewStatus")}
              lockedLabel={t("previewLockedLabel")}
              pick={t("previewPick")}
              scoreLabel={t("previewScoreLabel")}
              score={t("previewScore")}
              customLabel={t("previewCustomLabel")}
              custom={t("previewCustom")}
              leaderLabel={t("previewLeader")}
              leaderName={t("previewLeaderName")}
              leaderChips={t("previewLeaderChips")}
            />
          </section>

          <section className="rounded-[34px] border border-[#dbe5f2] bg-white p-7 shadow-[0_24px_70px_rgba(30,58,138,0.08)] sm:p-8">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
                {t("whyLabel")}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E3A8A]">
                {t("whyTitle")}
              </h2>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {featureCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[26px] border border-[#dbe5f2] bg-[#F8FBFF] p-5"
                >
                  <h3 className="text-lg font-black tracking-tight text-[#1E3A8A]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-[34px] border border-[#dbe5f2] bg-white p-7 shadow-[0_24px_70px_rgba(30,58,138,0.08)] sm:p-8">
              <span className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#EA580C]">
                {t("ideasLabel")}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E3A8A]">
                {t("ideasTitle")}
              </h2>

              <div className="mt-6 space-y-4">
                {ideaCards.map((item, index) => (
                  <article
                    key={item.title}
                    className="rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4"
                  >
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_100%)] text-sm font-black text-white shadow-[0_8px_20px_rgba(30,58,138,0.25)]">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-[#1E3A8A]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-[#dbe5f2] bg-white p-7 shadow-[0_24px_70px_rgba(30,58,138,0.08)] sm:p-8">
              <span className="inline-flex rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#1D4ED8]">
                {t("stepsLabel")}
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E3A8A]">
                {t("stepsTitle")}
              </h2>

              <div className="mt-6 space-y-5">
                {steps.map((item, index) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex shrink-0 flex-col items-center">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-sm font-black text-[#1D4ED8]">
                        {index + 1}
                      </span>
                      {index < steps.length - 1 ? (
                        <span className="mt-2 h-full w-px bg-[#dbe5f2]" aria-hidden="true" />
                      ) : null}
                    </div>
                    <div className="pb-2">
                      <h3 className="text-lg font-black tracking-tight text-[#1E3A8A]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[34px] border border-[#dbe5f2] bg-white p-7 shadow-[0_24px_70px_rgba(30,58,138,0.08)] sm:p-8">
            <span className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#EA580C]">
              {t("faqLabel")}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-[#1E3A8A]">
              {t("faqTitle")}
            </h2>

            <div className="mt-6 space-y-3">
              {faq.map((item) => (
                <article
                  key={item.question}
                  className="rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4"
                >
                  <h3 className="text-lg font-black tracking-tight text-[#1E3A8A]">
                    {item.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.answer}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </main>
    </>
  );
}
