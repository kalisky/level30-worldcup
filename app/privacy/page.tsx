import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PublicSiteFooter from "@/components/PublicSiteFooter";
import { LEGAL_COMPANY_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Buckeclub",
  description: "Minimal privacy policy for Buckeclub.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4">
      <h2 className="text-lg font-black tracking-tight text-[#1E3A8A]">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-3xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-500 transition hover:text-[#1E3A8A]"
            >
              ← Back home
            </Link>
          </div>

          <header className="mb-8">
            <div className="inline-flex rounded-full bg-[#E0EEFF] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#1D4ED8]">
              Legal
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#1E3A8A]">
              Privacy Policy
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              This policy explains what Buckeclub collects and how {LEGAL_COMPANY_NAME}{" "}
              uses it.
            </p>
          </header>

          <div className="space-y-4">
            <Section title="1. What we collect">
              <p>
                We collect the basic account information provided through Google
                sign-in, such as your email, name, and profile image, plus the
                display name you choose inside Buckeclub.
              </p>
              <p>
                We also collect the room activity needed to run the app,
                including your picks, wagers, custom bets, room membership, and
                leaderboard-related chip activity.
              </p>
            </Section>

            <Section title="2. How we use it">
              <p>
                We use your data to sign you in, run private rooms, save your
                bets, show leaderboards, protect the service, and improve the
                product.
              </p>
            </Section>

            <Section title="3. Analytics and cookies">
              <p>
                We use Mixpanel for product analytics. We do not use advertising
                cookies or ad trackers.
              </p>
              <p>
                Buckeclub does use a necessary session cookie to keep you signed
                in after Google authentication.
              </p>
            </Section>

            <Section title="4. Sharing">
              <p>
                We do not sell your personal data. We share data only with
                service providers needed to operate Buckeclub, currently Google
                for sign-in and Mixpanel for analytics.
              </p>
            </Section>

            <Section title="5. Retention">
              <p>
                We keep your account and betting data until you ask us to remove
                it.
              </p>
            </Section>

            <Section title="6. Your choices">
              <p>
                You can request deletion of your account or data at any time by
                emailing{" "}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="font-semibold text-[#1E3A8A] hover:underline"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>

            <Section title="7. Contact">
              <p>
                Buckeclub is operated by {LEGAL_COMPANY_NAME}. For privacy
                questions, contact{" "}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="font-semibold text-[#1E3A8A] hover:underline"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>
      <PublicSiteFooter />
    </>
  );
}
