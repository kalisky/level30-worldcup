"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import CopyBetsDialog from "@/components/CopyBetsDialog";

export default function CopyBetsLauncher({
  targetRoomCode,
  otherRooms,
}: {
  targetRoomCode: string;
  otherRooms: { code: string; name: string }[];
}) {
  const t = useTranslations("copyBets");
  const [open, setOpen] = useState(false);

  if (otherRooms.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#cdd9ea] bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF]"
      >
        <span aria-hidden>📋</span>
        {t("button")}
      </button>
      <CopyBetsDialog
        open={open}
        onClose={() => setOpen(false)}
        targetRoomCode={targetRoomCode}
        otherRooms={otherRooms}
      />
    </>
  );
}
