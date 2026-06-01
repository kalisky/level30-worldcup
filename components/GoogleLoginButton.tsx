"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

const REDIRECT_PENDING_KEY = "google_auth_redirect_pending";
const REDIRECT_TARGET_KEY = "google_auth_redirect_target";

let redirectResultClaimed = false;

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.5 0-.72-.06-1.38-.19-2H12Z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.3-2.56c-.91.61-2.08.98-3.31.98-2.54 0-4.69-1.71-5.46-4.01l-3.41 2.63C4.79 19.9 8.11 22 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.98A5.96 5.96 0 0 1 6.23 12c0-.69.12-1.35.31-1.98L3.13 7.39A9.96 9.96 0 0 0 2 12c0 1.61.39 3.13 1.13 4.61l3.41-2.63Z"
      />
      <path
        fill="#34A853"
        d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.95 3.03 14.69 2 12 2 8.11 2 4.79 4.1 3.13 7.39l3.41 2.63c.77-2.3 2.92-4.01 5.46-4.01Z"
      />
    </svg>
  );
}

export default function GoogleLoginButton({
  redirectTo = "/",
  className,
  label,
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem(REDIRECT_PENDING_KEY)) return;
    if (redirectResultClaimed) return;

    redirectResultClaimed = true;

    const auth = getFirebaseClientAuth({ preferSameOriginAuthDomain: true });

    void (async () => {
      try {
        const result = await getRedirectResult(auth);

        if (!result) {
          clearRedirectState();
          setPending(false);
          return;
        }

        await finalizeGoogleSignIn(
          result,
          getStoredRedirectTarget() ?? redirectTo,
          t
        );
      } catch (e) {
        clearRedirectState();
        setError(e instanceof Error ? e.message : t("signInFailed"));
        setPending(false);
      }
    })();
  }, [redirectTo, t]);

  async function signIn() {
    setPending(true);
    setError(null);

    try {
      const shouldUseRedirect = isMobileGoogleRedirectFlow();
      const auth = getFirebaseClientAuth({
        preferSameOriginAuthDomain: shouldUseRedirect,
      });
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      if (shouldUseRedirect) {
        storeRedirectTarget(redirectTo);
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      await finalizeGoogleSignIn(result, redirectTo, t);
    } catch (e) {
      clearRedirectState();
      setError(e instanceof Error ? e.message : t("signInFailed"));
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
          "flex w-full items-center justify-center gap-3 rounded-[24px] bg-[linear-gradient(135deg,#1E3A8A_0%,#2563EB_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <GoogleMark />
        </span>
        <span>{pending ? t("signingIn") : (label ?? t("continueWithGoogle"))}</span>
      </button>
      {error && (
        <p className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function isMobileGoogleRedirectFlow() {
  if (typeof window === "undefined") return false;

  const touchMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const mobileHint = (navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  }).userAgentData?.mobile;
  const userAgent =
    mobileHint ??
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) ||
      touchMac);

  return Boolean(userAgent);
}

async function finalizeGoogleSignIn(
  result: UserCredential,
  redirectTo: string,
  t: ReturnType<typeof useTranslations<"auth">>
) {
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
    throw new Error(payload?.error ?? t("signInFailed"));
  }

  const payload = (await response.json()) as {
    needsProfile: boolean;
  };

  clearRedirectState();

  if (payload.needsProfile) {
    window.location.assign(`/welcome?next=${encodeURIComponent(redirectTo)}`);
    return;
  }

  window.location.assign(redirectTo);
}

function storeRedirectTarget(redirectTo: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
  sessionStorage.setItem(REDIRECT_TARGET_KEY, redirectTo);
}

function getStoredRedirectTarget() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REDIRECT_TARGET_KEY);
}

function clearRedirectState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  sessionStorage.removeItem(REDIRECT_TARGET_KEY);
}
