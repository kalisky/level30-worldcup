"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CreateRoomLauncher from "@/components/CreateRoomLauncher";
import { signOut } from "@/lib/actions/auth";
import { normalizeRoomCode } from "@/lib/code";

export type ProfileRoomSummary = {
  id: string;
  code: string;
  name: string;
  chips: number;
  isCreator: boolean;
};

type NavigationItem = {
  href: string;
  label: string;
  tone?: "neutral" | "blue" | "coral";
};

export default function ProfileDialog({
  open,
  onClose,
  viewerName,
  rooms,
  currentRoomCode,
  navigationItems = [],
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  viewerName: string;
  rooms: ProfileRoomSummary[];
  currentRoomCode?: string | null;
  navigationItems?: NavigationItem[];
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signOutPending, startSignOutTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (triggerRef?.current?.contains(target)) {
        return;
      }

      if (!rootRef.current?.contains(target)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  function goToRoom(roomCode: string) {
    onClose();
    router.push(`/r/${roomCode}/dashboard`);
  }

  function submitRoomCode() {
    const code = normalizeRoomCode(joinCode);
    if (!code) {
      setJoinError(t("joinInvalid"));
      return;
    }

    setJoinError(null);
    setJoinOpen(false);
    onClose();
    router.push(`/r/${code}`);
  }

  function handleSignOut() {
    setSignOutError(null);
    startSignOutTransition(async () => {
      try {
        await signOut();
        onClose();
        router.push("/");
        router.refresh();
      } catch (error) {
        setSignOutError(
          error instanceof Error ? error.message : t("signOutFailed")
        );
      }
    });
  }

  function getInitial(name: string) {
    return name.trim().charAt(0).toUpperCase() || "?";
  }

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-[calc(100%+0.7rem)] z-[55] w-[min(22rem,calc(100vw-1.5rem))] rounded-[28px] border border-[#dbe5f2] bg-white p-3 shadow-[0_22px_60px_rgba(15,23,42,0.10)]"
    >
      <div className="flex items-center gap-3 rounded-[22px] px-3 py-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_100%)] text-sm font-black text-white shadow-[0_10px_24px_rgba(30,58,138,0.22)]">
          {getInitial(viewerName)}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-500">
            {t("signedIn")}
          </p>
          <p className="truncate text-base font-black text-[#1E3A8A]">
            {viewerName}
          </p>
        </div>
      </div>

      <div className="my-3 h-px bg-[#e4edf8]" />

      {navigationItems.length > 0 && (
        <>
          <section className="space-y-1">
            {navigationItems.map((item) => {
              const toneClass =
                item.tone === "blue"
                  ? "bg-[#E0EEFF] text-[#1D4ED8]"
                  : item.tone === "coral"
                    ? "bg-[#FFF1E8] text-[#EA580C]"
                    : "text-slate-700 hover:bg-[#F8FBFF] hover:text-[#1E3A8A]";

              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={onClose}
                  className={`block rounded-[20px] px-3 py-3 text-sm font-semibold transition ${toneClass}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </section>

          <div className="my-3 h-px bg-[#e4edf8]" />
        </>
      )}

      <section>
        <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500">
          {t("yourRooms")}
        </p>
        {rooms.length === 0 ? (
          <p className="mt-2 rounded-[20px] bg-[#F8FBFF] px-4 py-4 text-sm text-slate-500">
            {t("noRooms")}
          </p>
        ) : (
          <div className="mt-2 space-y-1">
            {rooms.map((room) => {
              const isCurrentRoom = currentRoomCode === room.code;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => goToRoom(room.code)}
                  className={
                    "flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-left transition " +
                    (isCurrentRoom ? "bg-[#F8FBFF]" : "hover:bg-[#F8FBFF]")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-[#1E3A8A]">
                        {room.name}
                      </p>
                      {room.isCreator && (
                        <span className="rounded-full bg-[#E0EEFF] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#1D4ED8]">
                          {t("admin")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {room.chips.toLocaleString()} {t("chipsLabel")}
                    </p>
                  </div>
                  {isCurrentRoom && (
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 text-[#3B82F6]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m4.5 10 3.2 3.2L15.5 5.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-3">
        <CreateRoomLauncher creatorName={viewerName} variant="row" />
      </section>

      <section className="mt-1">
        {!joinOpen ? (
          <button
            type="button"
            onClick={() => {
              setJoinOpen(true);
              setJoinError(null);
            }}
            className="flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-left text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#F8FBFF]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E0EEFF] text-[#1D4ED8]">
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3" />
                <path d="M8 6 4 10l4 4" />
                <path d="M4 10h9" />
              </svg>
            </span>
            <span>{t("joinAnotherRoom")}</span>
          </button>
        ) : (
          <div className="rounded-[20px] bg-[#F8FBFF] px-3 py-3">
            <label className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("joinRoomLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder="ABCDE"
                autoCapitalize="characters"
                autoComplete="off"
                dir="ltr"
                className="min-w-0 flex-1 rounded-2xl border border-[#cdd9ea] bg-white px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#1E3A8A] placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:border-[#3B82F6] focus:outline-none"
              />
              <button
                type="button"
                onClick={submitRoomCode}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]"
                aria-label={t("joinSubmit")}
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 10h11" />
                  <path d="m10 5 5 5-5 5" />
                </svg>
              </button>
            </div>
            {joinError && (
              <p className="mt-2 text-xs font-medium text-red-700">{joinError}</p>
            )}
          </div>
        )}
      </section>

      <div className="my-3 h-px bg-[#e4edf8]" />

      <section>
        <button
          type="button"
          disabled={signOutPending}
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-[20px] px-3 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A] disabled:opacity-50"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8" />
            <path d="M13 6l4 4-4 4" />
            <path d="M17 10H8" />
          </svg>
          <span>{signOutPending ? t("signingOut") : t("signOut")}</span>
        </button>
        {signOutError && (
          <p className="mt-2 px-3 text-xs font-medium text-red-700">
            {signOutError}
          </p>
        )}
      </section>
    </div>
  );
}
