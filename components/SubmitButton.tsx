"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * `<SubmitButton>` is a drop-in replacement for `<button type="submit">` inside
 * any `<form action={serverAction}>`. It uses `useFormStatus` to know when the
 * server action is in flight, then:
 *   - disables itself,
 *   - sets `aria-busy`,
 *   - shows a spinner with an optional `pendingLabel`.
 *
 * Use this anywhere a form posts to a server action and the user might wonder
 * "did my click register?".
 */
export default function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...rest
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={className}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner />
          {pendingLabel ?? "Working…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
