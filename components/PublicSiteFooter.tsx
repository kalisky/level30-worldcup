import Link from "next/link";
import { LEGAL_COMPANY_NAME } from "@/lib/legal";

export default function PublicSiteFooter({
  className = "",
}: {
  className?: string;
}) {
  return (
    <footer className={`border-t border-[#dbe5f2] bg-white/70 ${className}`.trim()}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500 sm:flex-row">
        <div className="text-center sm:text-left">
          © {new Date().getFullYear()} {LEGAL_COMPANY_NAME}
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/terms"
            className="font-semibold text-slate-500 transition hover:text-[#1E3A8A]"
          >
            Terms of Use
          </Link>
          <Link
            href="/privacy"
            className="font-semibold text-slate-500 transition hover:text-[#1E3A8A]"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
