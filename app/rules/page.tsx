import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Rules | Buckeclub",
  description: "Simple rules for Buckeclub.",
};

export default async function RulesPage() {
  const t = await getTranslations("rules");
  const tc = await getTranslations("common");
  const rules = t.raw("list") as string[];

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
              ← {tc("back")}
            </Link>
          </div>

          <header className="mb-8">
            <div className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#EA580C]">
              {t("quickRules")}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#1E3A8A]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {t("intro")}
            </p>
          </header>

          <ol className="space-y-3">
            {rules.map((rule, index) => (
              <li
                key={index}
                className="flex gap-4 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_100%)] text-sm font-black text-white shadow-[0_8px_20px_rgba(30,58,138,0.25)]">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-slate-700">{rule}</p>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </>
  );
}
