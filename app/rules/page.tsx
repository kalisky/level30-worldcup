import type { Metadata } from "next";
import Link from "next/link";

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
  "During live matches, anyone can propose custom bets for extra action.",
  "When a match or custom bet is settled, winners are paid in chips.",
  "Highest chip count at the end wins. No real money involved.",
];

export default function RulesPage() {
  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Rules</h1>
          <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
            Short version: predict matches better than your friends and finish
            with the most chips.
          </p>
        </header>

        <ol className="space-y-3">
          {rules.map((rule, index) => (
            <li
              key={rule}
              className="flex gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="mt-0.5 w-7 shrink-0 rounded-full bg-zinc-100 text-center font-mono text-sm leading-7 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {rule}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
