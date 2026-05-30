"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";

type LocaleCode = "en" | "he";

const LOCALES: { code: LocaleCode; flag: string; name: string }[] = [
  { code: "en", flag: "🇬🇧", name: "English" },
  { code: "he", flag: "🇮🇱", name: "עברית" },
];

/**
 * Flag-based language picker. The trigger shows the *currently active*
 * language's flag (so it always reads as the current state, not the action).
 * Clicking opens a small dropdown with every available language. Selecting a
 * different one calls the setLocale server action and the page re-renders.
 */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as LocaleCode;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function switchTo(code: LocaleCode) {
    if (code === locale) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("locale", code);
    startTransition(async () => {
      await setLocale(fd);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className={"relative " + (className ?? "")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.name}`}
        title={current.name}
        className="inline-flex items-center gap-1 rounded-full border border-[#cdd9ea] bg-white px-2.5 py-1.5 text-sm font-bold text-[#1E3A8A] transition hover:border-[#3B82F6] hover:bg-[#F8FBFF] disabled:cursor-progress disabled:opacity-60"
      >
        <span className="text-base leading-none" aria-hidden>{current.flag}</span>
        <span aria-hidden className="text-[0.65rem] text-slate-500">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute end-0 top-full z-50 mt-2 min-w-[9.5rem] overflow-hidden rounded-2xl border border-[#dbe5f2] bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
        >
          {LOCALES.map((l) => {
            const active = l.code === locale;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => switchTo(l.code)}
                  disabled={pending}
                  className={
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
                    (active
                      ? "bg-[#EFF6FF] text-[#1D4ED8]"
                      : "text-[#1E3A8A] hover:bg-[#F8FBFF]")
                  }
                >
                  <span className="text-base leading-none" aria-hidden>{l.flag}</span>
                  <span className="flex-1 text-start">{l.name}</span>
                  {active && (
                    <span aria-hidden className="text-[#1D4ED8]">✓</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
