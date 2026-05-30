"use client";

import Link from "next/link";
import { useState } from "react";
import type { Room, User } from "@/lib/db/schema";
import ProfileDialog from "@/components/ProfileDialog";
import type { ProfileRoomSummary } from "@/components/ProfileDialog";
import RoomSettingsDialog from "@/components/RoomSettingsDialog";

function LogoMark() {
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_60%,#F97316_100%)] shadow-[0_10px_24px_rgba(30,58,138,0.28)]">
      <span className="absolute inset-[7px] rounded-[14px] border border-white/35" />
      <span className="relative h-5 w-5 rounded-full border-2 border-white/95">
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/85" />
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/85" />
      </span>
    </span>
  );
}

function HeaderLink({
  href,
  label,
  tone = "neutral",
  onClick,
}: {
  href: string;
  label: string;
  tone?: "neutral" | "blue" | "coral";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[#E0EEFF] text-[#1D4ED8] hover:bg-[#D2E7FF]"
      : tone === "coral"
        ? "bg-[#FFF1E8] text-[#EA580C] hover:bg-[#FFE3D3]"
        : "text-slate-600 hover:bg-white hover:text-[#1E3A8A]";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${toneClass}`}
    >
      {label}
    </Link>
  );
}

function MobileMenuLink({
  href,
  label,
  tone = "neutral",
  onClick,
}: {
  href: string;
  label: string;
  tone?: "neutral" | "blue" | "coral";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[#E0EEFF] text-[#1D4ED8]"
      : tone === "coral"
        ? "bg-[#FFF1E8] text-[#EA580C]"
        : "text-slate-700 hover:bg-[#F8FBFF] hover:text-[#1E3A8A]";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${toneClass}`}
    >
      {label}
    </Link>
  );
}

function MobileMenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-[#F8FBFF] hover:text-[#1E3A8A]"
    >
      {label}
    </button>
  );
}

function ProfileTrigger({
  label,
  chips,
  onClick,
}: {
  label: string;
  chips?: number;
  onClick: () => void;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-3.5 py-2.5 text-white shadow-[0_10px_24px_rgba(30,58,138,0.25)] transition hover:-translate-y-0.5"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/18 text-sm font-black">
        {initial}
      </span>
      <span className="flex min-w-0 flex-col items-start">
        <span className="max-w-[8rem] truncate text-sm font-bold">{label}</span>
        {typeof chips === "number" && (
          <span className="font-mono text-[0.7rem] font-semibold text-white/78">
            {chips} chips
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 shrink-0 text-white/85"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m5 7 5 5 5-5" />
      </svg>
    </button>
  );
}

export default function AppHeaderClient({
  room,
  user,
  active,
  initialRoomModalOpen = false,
  viewerName,
  profileRooms,
}: {
  room?: Room;
  user?: User;
  active?: "dashboard" | "admin";
  initialRoomModalOpen?: boolean;
  viewerName?: string | null;
  profileRooms: ProfileRoomSummary[];
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(initialRoomModalOpen);
  const [profileMenuMode, setProfileMenuMode] = useState<
    "desktop" | "mobile" | null
  >(null);
  const [showCreatedInvite, setShowCreatedInvite] =
    useState(initialRoomModalOpen);

  function clearCreatedFlag() {
    if (!showCreatedInvite) return;
    if (typeof window === "undefined") return;
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete("created");
    const nextUrl =
      nextParams.size > 0
        ? `${window.location.pathname}?${nextParams.toString()}`
        : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
    setShowCreatedInvite(false);
  }

  function openRoomModal() {
    setProfileMenuMode(null);
    setRoomModalOpen(true);
  }

  function closeRoomModal() {
    setRoomModalOpen(false);
    clearCreatedFlag();
  }

  function toggleProfileModal(mode: "desktop" | "mobile") {
    setRoomModalOpen(false);
    setMobileMenuOpen(false);
    setProfileMenuMode((currentMode) =>
      currentMode === mode ? null : mode
    );
  }

  function closeProfileModal() {
    setProfileMenuMode(null);
  }

  const pillName = user?.name ?? viewerName ?? null;
  const showProfilePill = !!pillName;
  const profileMenuOpen = profileMenuMode !== null;
  const showMobileOverlay =
    mobileMenuOpen || profileMenuMode === "mobile";
  const mobileNavigationItems = room
    ? [
        {
          href: `/r/${room.code}/dashboard`,
          label: "Dashboard",
          tone: active === "dashboard" ? ("blue" as const) : ("neutral" as const),
        },
        {
          href: `/r/${room.code}/admin`,
          label: "Settle",
          tone: active === "admin" ? ("coral" as const) : ("neutral" as const),
        },
        {
          href: "/rules",
          label: "Read the rules",
          tone: "neutral" as const,
        },
      ]
    : [
        {
          href: "/rules",
          label: "Read the rules",
          tone: "neutral" as const,
        },
      ];

  return (
    <>
      {room && user && (
        <RoomSettingsDialog
          room={room}
          user={user}
          open={roomModalOpen}
          onClose={closeRoomModal}
          emphasizeInvite={showCreatedInvite}
        />
      )}

      {showMobileOverlay && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => {
            setMobileMenuOpen(false);
            closeProfileModal();
          }}
          className="fixed inset-x-0 bottom-0 top-[4.75rem] z-10 bg-black/50 sm:hidden"
        />
      )}

      <header className="sticky top-0 z-20 border-b border-[#dbe5f2] bg-white/92 shadow-[0_10px_32px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:py-3">
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={room ? `/r/${room.code}/dashboard` : "/"}
                className="flex min-w-0 items-center gap-3"
              >
                <LogoMark />
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-slate-500">
                    Premium Sportsbook
                  </p>
                  <p className="text-lg font-black tracking-tight text-[#1E3A8A]">
                    World Cup Bets
                  </p>
                </div>
              </Link>

              {room && user && (
                <button
                  type="button"
                  onClick={openRoomModal}
                  className="hidden rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-[#3B82F6] hover:bg-white sm:block"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Room
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1E3A8A]">
                      {room.name}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[0.7rem] font-bold text-slate-500 ring-1 ring-[#dbe5f2]">
                      {room.code}
                    </span>
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              {showProfilePill && (
                <button
                  type="button"
                  onClick={() => toggleProfileModal("mobile")}
                  aria-expanded={profileMenuOpen}
                  aria-label={profileMenuOpen ? "Close menu" : "Open menu"}
                  className="inline-flex items-center gap-2 rounded-[18px] border border-[#dbe5f2] bg-white px-3 py-2.5 text-[#1E3A8A] shadow-[0_10px_24px_rgba(15,23,42,0.10)] transition hover:bg-[#F8FBFF]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] text-sm font-black text-white">
                    {pillName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                </button>
              )}

              {!showProfilePill && (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen((value) => !value)}
                    aria-expanded={mobileMenuOpen}
                    aria-label="Open navigation menu"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] text-[#1E3A8A] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </button>

                  {mobileMenuOpen && (
                    <div className="absolute right-4 top-[calc(100%-0.25rem)] z-30 w-64 rounded-[24px] border border-[#dbe5f2] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                      <nav className="space-y-1">
                        {room && user && (
                          <MobileMenuButton
                            label={`Room details · ${room.code}`}
                            onClick={() => {
                              setMobileMenuOpen(false);
                              openRoomModal();
                            }}
                          />
                        )}
                        {room && (
                          <>
                            <MobileMenuLink
                              href={`/r/${room.code}/dashboard`}
                              label="Dashboard"
                              tone={active === "dashboard" ? "blue" : "neutral"}
                              onClick={() => setMobileMenuOpen(false)}
                            />
                            <MobileMenuLink
                              href={`/r/${room.code}/admin`}
                              label="Settle"
                              tone={active === "admin" ? "coral" : "neutral"}
                              onClick={() => setMobileMenuOpen(false)}
                            />
                          </>
                        )}
                        <MobileMenuLink
                          href="/rules"
                          label="Read the rules"
                          tone="neutral"
                          onClick={() => setMobileMenuOpen(false)}
                        />
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-3 sm:flex sm:justify-end">
            <nav className="flex flex-wrap items-center gap-1 rounded-[20px] border border-[#dbe5f2] bg-[#F8FBFF] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              {room && (
                <>
                  <HeaderLink
                    href={`/r/${room.code}/dashboard`}
                    label="Dashboard"
                    tone={active === "dashboard" ? "blue" : "neutral"}
                  />
                  <HeaderLink
                    href={`/r/${room.code}/admin`}
                    label="Settle"
                    tone={active === "admin" ? "coral" : "neutral"}
                  />
                </>
              )}
              <HeaderLink href="/rules" label="Read the rules" tone="neutral" />
            </nav>

            {showProfilePill && (
              <div className="hidden sm:block">
                <ProfileTrigger
                  label={pillName}
                  chips={user?.chips}
                  onClick={() => toggleProfileModal("desktop")}
                />
              </div>
            )}
          </div>

          {showProfilePill && (
            <ProfileDialog
              open={profileMenuOpen}
              onClose={closeProfileModal}
              viewerName={pillName}
              rooms={profileRooms}
              currentRoomCode={room?.code ?? null}
              navigationItems={
                profileMenuMode === "mobile" ? mobileNavigationItems : []
              }
              roomDetailsLabel={
                profileMenuMode === "mobile" && room && user
                  ? `Room details · ${room.code}`
                  : null
              }
              onOpenRoomDetails={
                profileMenuMode === "mobile" && room && user
                  ? openRoomModal
                  : null
              }
            />
          )}
        </div>
      </header>
    </>
  );
}
