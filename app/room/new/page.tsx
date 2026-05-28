import Link from "next/link";
import { createRoom } from "@/lib/actions/rooms";

export default function NewRoomPage() {
  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Create a room</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Add up to six friends. You can edit names later.
        </p>

        <form action={createRoom} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium"
            >
              Room name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={60}
              placeholder="The Squad"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="startingChips"
              className="mb-1.5 block text-sm font-medium"
            >
              Starting chips per friend
            </label>
            <input
              id="startingChips"
              name="startingChips"
              type="number"
              min={1}
              max={1000000}
              defaultValue={1000}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Friends</legend>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  name="members"
                  type="text"
                  maxLength={40}
                  placeholder={
                    i === 0 ? "You (first slot = creator)" : `Friend ${i + 1}`
                  }
                  required={i === 0}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Leave the rest blank if it's just a few of you.
            </p>
          </fieldset>

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create room
          </button>
        </form>
      </div>
    </main>
  );
}
