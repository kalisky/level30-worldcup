import Link from "next/link";
import { joinRoomByCode } from "@/lib/actions/rooms";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight">World Cup Bets</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Bet with your friends on the 2026 World Cup. Pre-match picks +
            custom lines invented live during games.
          </p>
        </header>

        <section className="space-y-4">
          <Link
            href="/room/new"
            className="block rounded-2xl bg-zinc-900 px-6 py-5 text-center text-lg font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create a room
          </Link>

          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-zinc-300 dark:border-zinc-700" />
            <span className="mx-3 text-xs uppercase tracking-wider text-zinc-500">
              or
            </span>
            <div className="flex-grow border-t border-zinc-300 dark:border-zinc-700" />
          </div>

          <form
            action={joinRoomByCode}
            className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <label htmlFor="code" className="block text-sm font-medium">
              Join an existing room
            </label>
            <input
              id="code"
              name="code"
              type="text"
              placeholder="ABCDE"
              autoCapitalize="characters"
              autoComplete="off"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              Continue
            </button>
          </form>
        </section>

        <footer className="mt-12 text-center text-xs text-zinc-500">
          Tournament kicks off June 11, 2026.
        </footer>
      </div>
    </main>
  );
}
