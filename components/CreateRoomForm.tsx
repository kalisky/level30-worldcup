"use client";

import { useFormStatus } from "react-dom";
import { createRoom } from "@/lib/actions/rooms";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Creating room…" : "Create room"}
    </button>
  );
}

export default function CreateRoomForm({
  creatorName,
}: {
  creatorName: string;
}) {
  return (
    <>
      <div className="mt-6 rounded-[24px] border border-[#dbe5f2] bg-[#F8FBFF] px-5 py-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-slate-500">
          Creator
        </p>
        <p className="mt-1 text-lg font-black text-[#1E3A8A]">{creatorName}</p>
      </div>

      <form action={createRoom} className="mt-8 space-y-6">
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
            htmlFor="maxMembers"
            className="mb-2 block text-sm font-bold text-[#1E3A8A]"
          >
            Max members
          </label>
          <input
            id="maxMembers"
            name="maxMembers"
            type="number"
            min={2}
            max={50}
            defaultValue={10}
            required
            className="w-full rounded-2xl border border-[#cdd9ea] bg-[#F8FBFF] px-4 py-3 text-[#1E3A8A] focus:border-[#3B82F6] focus:bg-white focus:outline-none"
          />
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            Default 10. You can raise it up to 50.
          </p>
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
