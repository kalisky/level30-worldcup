"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export default function GoogleLoginButton({
  redirectTo = "/",
  className,
  label = "Continue with Google",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    try {
      const auth = getFirebaseClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Google sign-in failed.");
      }

      const payload = (await response.json()) as {
        needsProfile: boolean;
      };

      if (payload.needsProfile) {
        window.location.assign(
          `/welcome?next=${encodeURIComponent(redirectTo)}`
        );
        return;
      }

      window.location.assign(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
      setPending(false);
      return;
    }

    setPending(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className={
          className ??
          "w-full rounded-[24px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Signing in…" : label}
      </button>
      {error && (
        <p className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
