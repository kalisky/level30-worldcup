"use client";

import { useState } from "react";
import CreateRoomDialog from "@/components/CreateRoomDialog";

export default function CreateRoomLauncher({
  creatorName,
  variant = "hero",
}: {
  creatorName: string;
  variant?: "hero" | "row";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full rounded-[24px] bg-[linear-gradient(135deg,#F97316_0%,#FB923C_100%)] px-6 py-5 text-center text-lg font-bold text-white shadow-[0_18px_36px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5"
        >
          Create a room
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-left text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#F8FBFF]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E0EEFF] text-base font-bold text-[#1D4ED8]">
            +
          </span>
          <span>Create a room</span>
        </button>
      )}

      <CreateRoomDialog
        open={open}
        onClose={() => setOpen(false)}
        creatorName={creatorName}
      />
    </>
  );
}
