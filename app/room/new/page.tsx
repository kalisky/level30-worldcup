import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createRoom } from "@/lib/actions/rooms";

export default function NewRoomPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-2xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-500 transition hover:text-[#1E3A8A]"
            >
              ← Back
            </Link>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-[#1E3A8A]">
            Create a room
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Set the chip stack, name your squad, and get the whole group into a
            branded World Cup book in under a minute.
          </p>

          <form action={createRoom} className="mt-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-bold text-[#1E3A8A]"
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
                  className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="startingChips"
                  className="mb-2 block text-sm font-bold text-[#1E3A8A]"
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
                  className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <fieldset className="rounded-[28px] border border-[#dbe5f2] bg-[#F8FBFF] p-5">
              <legend className="px-2 text-sm font-bold text-[#1E3A8A]">
                Friends
              </legend>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                    className="w-full rounded-2xl border border-[#cdd9ea] bg-white px-4 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:outline-none"
                  />
                ))}
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Leave the rest blank if it&apos;s just a few of you.
              </p>
            </fieldset>

            <button
              type="submit"
              className="w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5"
            >
              Create room
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
