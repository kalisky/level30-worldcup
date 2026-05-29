import Link from "next/link";
import type { Room, User } from "@/lib/db/schema";

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
}: {
  href: string;
  label: string;
  tone?: "neutral" | "blue" | "coral";
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
}: {
  href: string;
  label: string;
  tone?: "neutral" | "blue" | "coral";
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
      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${toneClass}`}
    >
      {label}
    </Link>
  );
}

export default function AppHeader({
  room,
  user,
  active,
}: {
  room?: Room;
  user?: User;
  active?: "dashboard" | "admin";
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dbe5f2] bg-white/92 shadow-[0_10px_32px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:py-3">
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

            {room && (
              <div className="hidden rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] lg:block">
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
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            {user && (
              <div className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-3.5 py-2.5 text-white shadow-[0_10px_24px_rgba(30,58,138,0.25)]">
                <span className="text-sm font-bold">{user.name}</span>
                <span className="rounded-full bg-white/18 px-2 py-0.5 font-mono text-xs font-bold">
                  {user.chips}
                </span>
              </div>
            )}

            <details className="group relative">
              <summary className="flex h-11 w-11 list-none items-center justify-center rounded-2xl border border-[#dbe5f2] bg-[#F8FBFF] text-[#1E3A8A] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-white [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Open navigation menu</span>
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
              </summary>

              <div className="absolute right-0 top-[calc(100%+0.6rem)] z-30 w-60 rounded-[24px] border border-[#dbe5f2] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                <nav className="space-y-1">
                  {room && (
                    <>
                      <MobileMenuLink
                        href={`/r/${room.code}/dashboard`}
                        label="Dashboard"
                        tone={active === "dashboard" ? "blue" : "neutral"}
                      />
                      <MobileMenuLink
                        href={`/r/${room.code}/admin`}
                        label="Settle"
                        tone={active === "admin" ? "coral" : "neutral"}
                      />
                    </>
                  )}
                  <MobileMenuLink
                    href="/rules"
                    label="Read the rules"
                    tone="neutral"
                  />
                </nav>
              </div>
            </details>
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

          {user && (
            <div className="hidden items-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-4 py-3 text-white shadow-[0_10px_24px_rgba(30,58,138,0.25)] sm:inline-flex">
              <span className="text-sm font-bold">{user.name}</span>
              <span className="rounded-full bg-white/18 px-2 py-0.5 font-mono text-xs font-bold">
                {user.chips}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
