"use client";

import { useTranslations } from "next-intl";
import {
  setApplyToAllRooms,
  useApplyToAllRooms,
} from "@/hooks/useApplyToAllRooms";

/**
 * Checkbox that controls whether a placed/edited bet is mirrored into the
 * user's other rooms. Only rendered when the user is actually in more than
 * one room (`otherRoomCount > 0`). Shared state lives in useApplyToAllRooms,
 * so toggling it on any bet card updates them all and persists.
 */
export default function ApplyToAllRoomsToggle({
  otherRoomCount,
}: {
  otherRoomCount: number;
}) {
  const tb = useTranslations("bet");
  const checked = useApplyToAllRooms();
  if (otherRoomCount <= 0) return null;

  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] px-3.5 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setApplyToAllRooms(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E3A8A]"
      />
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-[#1E3A8A]">
          {tb("applyToAllRooms", { count: otherRoomCount + 1 })}
        </span>
        <span className="block text-xs text-slate-500">
          {tb("applyToAllRoomsHint")}
        </span>
      </span>
    </label>
  );
}
