import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PublicSiteFooter from "@/components/PublicSiteFooter";
import { LEGAL_COMPANY_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use | Buckeclub",
  description: "Minimal terms of use for Buckeclub.",
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

export default function TermsPage() {
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
            <div className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#EA580C]">
              Legal
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#1E3A8A]">
              Terms of Use
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              These terms govern your use of Buckeclub, a private social
              prediction app operated by {LEGAL_COMPANY_NAME}.
            </p>
          </header>

          <div className="space-y-4">
            <Section title="1. What Buckeclub is">
              <p>
                Buckeclub lets groups of friends create private rooms, make
                predictions, and place friendly bets using virtual chips.
                Buckeclub is not a real-money betting service.
              </p>
            </Section>

            <Section title="2. Accounts">
              <p>
                You sign in with Google and are responsible for activity that
                happens through your account. Please keep your account
                information accurate and do not impersonate other people.
              </p>
            </Section>

            <Section title="3. Acceptable use">
              <p>
                You may use Buckeclub only for lawful, personal, and friendly
                competition. Do not misuse the service, interfere with it, try
                to access data that is not yours, or post unlawful or abusive
                content.
              </p>
            </Section>

            <Section title="4. Your rooms, picks, and custom bets">
              <p>
                You are responsible for the room names, display names, picks,
                and custom bet text you create. You keep ownership of that
                content, but you give Buckeclub permission to host and display
                it as needed to operate the service.
              </p>
            </Section>

            <Section title="5. Suspension or closure">
              <p>
                We may suspend or remove access if the service is abused or if
                we need to protect Buckeclub or other users. You can also ask
                us to remove your account and data by emailing{" "}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="font-semibold text-[#1E3A8A] hover:underline"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>

            <Section title="6. Changes">
              <p>
                We may update Buckeclub or these terms from time to time. By
                continuing to use the service after changes take effect, you
                accept the updated terms.
              </p>
            </Section>

            <Section title="7. Contact">
              <p>
                Buckeclub is operated by {LEGAL_COMPANY_NAME}. For questions
                about these terms, contact{" "}
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
