"use client";

import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import CreateRoomForm from "@/components/CreateRoomForm";

export default function CreateRoomDialog({
  open,
  onClose,
  creatorName,
}: {
  open: boolean;
  onClose: () => void;
  creatorName: string;
}) {
  const t = useTranslations("createRoom");
  const tc = useTranslations("common");
  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  if (!open || !portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-[32px] border border-[#dbe5f2] bg-white p-8 shadow-[0_24px_70px_rgba(30,58,138,0.10)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-[#1E3A8A]">
              {t("title")}
            </h2>
            <p className="mt-2 max-w-xl text-slate-600">
              {t("subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#dbe5f2] px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
          >
            {tc("close")}
          </button>
        </div>

        <CreateRoomForm creatorName={creatorName} />
      </div>
    </div>,
    portalTarget
  );
}
