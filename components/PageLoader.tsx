/**
 * Full-page loading indicator shown by `loading.tsx` Suspense fallbacks
 * during route transitions. Small, centered, matches the brand palette.
 */
export default function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <svg
        className="h-10 w-10 animate-spin text-[#1E3A8A]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
      )}
    </div>
  );
}
