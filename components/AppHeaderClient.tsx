"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { Room, User } from "@/lib/db/schema";
import ProfileDialog from "@/components/ProfileDialog";
import type { ProfileRoomSummary } from "@/components/ProfileDialog";
import RoomSettingsDialog from "@/components/RoomSettingsDialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function LogoMark() {
  return (
    <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        aria-hidden="true"
        className="drop-shadow-[0_10px_24px_rgba(24,95,165,0.18)]"
      >
        <rect width="100" height="100" rx="22" fill="#185FA5" />
        <rect x="22" y="22" width="22" height="56" rx="5" fill="#FFFFFF" />
        <rect x="56" y="34" width="22" height="44" rx="5" fill="#B5D4F4" />
      </svg>
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
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
  const mobileProfileTriggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  function navigateBackToDashboard(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof window === "undefined" || window.history.length <= 1) return;

    event.preventDefault();
    router.back();
  }

  function handleMobileDashboardClick(event: MouseEvent<HTMLAnchorElement>) {
    setMobileMenuOpen(false);
    if (preferDashboardBack) {
      navigateBackToDashboard(event);
    }
  }

  const t = useTranslations("nav");
  const pillName = user?.name ?? viewerName ?? null;
  const showProfilePill = !!pillName;
  const profileMenuOpen = profileMenuMode !== null;
  const showMobileOverlay =
    mobileMenuOpen || profileMenuMode === "mobile";
  const preferDashboardBack = searchParams.get("from") === "dashboard";
  const adminHref =
    room && active === "dashboard"
      ? `/r/${room.code}/admin?from=dashboard`
      : room
        ? `/r/${room.code}/admin`
        : null;
  const mobileNavigationItems = room
    ? [
        {
          href: `/r/${room.code}/dashboard`,
          label: t("dashboard"),
          tone: active === "dashboard" ? ("blue" as const) : ("neutral" as const),
        },
        {
          href: adminHref ?? `/r/${room.code}/admin`,
          label: t("settle"),
          tone: active === "admin" ? ("coral" as const) : ("neutral" as const),
        },
        {
          href: "/rules",
          label: t("rules"),
          tone: "neutral" as const,
        },
      ]
    : [
        {
          href: "/rules",
          label: t("rules"),
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
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
            <div className="flex min-w-0 items-center gap-[9px]">
              <Link
                href={room ? `/r/${room.code}/dashboard` : "/"}
                onClick={preferDashboardBack ? navigateBackToDashboard : undefined}
                className="flex min-w-0 flex-1 items-center gap-[9px]"
              >
                <LogoMark />
                <div className="min-w-0 ">
                  <p
                    className="text-2xl font-semibold text-[#185FA5] md:text-3xl"
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      letterSpacing: "-0.6px",
                    }}
                  >
                    Buckeclub
                  </p>
                  <p className="mt-1 text-[0.54rem] font-bold uppercase leading-[1.35] tracking-[0.22em] text-slate-500 sm:text-[0.65rem] sm:tracking-[0.28em]">
                    Social sports predictions
                  </p>
                </div>
              </Link>

              {room && user && (
                <button
                  type="button"
                  onClick={openRoomModal}
                  className="hidden rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-[#3B82F6] hover:bg-white sm:block"
                >
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1E3A8A]">
                      {room.name}
                    </span>
                  </div>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              {showProfilePill && (
                <button
                  ref={mobileProfileTriggerRef}
                  type="button"
                  onClick={() => toggleProfileModal("mobile")}
                  aria-expanded={profileMenuOpen}
                  aria-label={profileMenuOpen ? "Close menu" : "Open menu"}
                  className="inline-flex items-center gap-1.5 rounded-[18px] border border-[#dbe5f2] bg-white px-2.5 py-2.5 text-[#1E3A8A] shadow-[0_10px_24px_rgba(15,23,42,0.10)] transition hover:bg-[#F8FBFF]"
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
                              label={t("dashboard")}
                              tone={active === "dashboard" ? "blue" : "neutral"}
                              onClick={handleMobileDashboardClick}
                            />
                            <MobileMenuLink
                              href={adminHref ?? `/r/${room.code}/admin`}
                              label={t("settle")}
                              tone={active === "admin" ? "coral" : "neutral"}
                              onClick={() => setMobileMenuOpen(false)}
                            />
                          </>
                        )}
                        <MobileMenuLink
                          href="/rules"
                          label={t("rules")}
                          tone="neutral"
                          onClick={() => setMobileMenuOpen(false)}
                        />
                        <div className="px-3 pt-2">
                          <LanguageSwitcher />
                        </div>
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
                    label={t("dashboard")}
                    tone={active === "dashboard" ? "blue" : "neutral"}
                    onClick={preferDashboardBack ? navigateBackToDashboard : undefined}
                  />
                  <HeaderLink
                    href={adminHref ?? `/r/${room.code}/admin`}
                    label={t("settle")}
                    tone={active === "admin" ? "coral" : "neutral"}
                  />
                </>
              )}
              <HeaderLink href="/rules" label={t("rules")} tone="neutral" />
              <LanguageSwitcher className="ml-1" />
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
              showLanguageSwitcher={profileMenuMode === "mobile"}
              triggerRef={
                profileMenuMode === "mobile" ? mobileProfileTriggerRef : undefined
              }
            />
          )}
        </div>
      </header>
    </>
  );
}
