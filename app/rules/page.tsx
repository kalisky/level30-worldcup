import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Rules | World Cup Bets",
  description: "Simple rules for the World Cup Bets game.",
};

const rules = [
  "Everyone starts with the same number of chips in a room.",
  "Before kickoff, you can place one prediction per match.",
  "A match prediction is one exact score, like 2-1 or 1-1.",
  "Your stake is split in two: half on the result direction, half on the exact score.",
  "If you get the winner or draw right, you win the direction half at the locked odds.",
  "If you get the exact score right, you also win the score half at the locked odds.",
  "Once kickoff happens, normal match betting closes.",
  "You can propose custom bets during a match or create room-wide custom bets at any time before their lock time.",
  "When a match or custom bet is settled, winners are paid in chips.",
  "Highest chip count at the end wins. No real money involved.",
];

export default function RulesPage() {
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
              ← Back
            </Link>
          </div>

          <header className="mb-8">
            <div className="inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#EA580C]">
              Quick rules
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#1E3A8A]">
              Rules
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Short version: predict matches better than your friends, manage
              your chips well, and finish the tournament at the top of the
              board.
            </p>
          </header>

          <ol className="space-y-3">
            {rules.map((rule, index) => (
              <li
                key={rule}
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
