"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function getBrowserAuthDomain(defaultAuthDomain: string, preferSameOriginAuthDomain: boolean) {
  if (!preferSameOriginAuthDomain || typeof window === "undefined") {
    return defaultAuthDomain;
  }

  const { hostname, host } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  return isLocalhost ? defaultAuthDomain : host;
}

function getFirebaseConfig({
  preferSameOriginAuthDomain = false,
}: {
  preferSameOriginAuthDomain?: boolean;
} = {}) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error("Firebase client config is missing.");
  }

  return {
    apiKey,
    authDomain: getBrowserAuthDomain(
      authDomain,
      preferSameOriginAuthDomain
    ),
    projectId,
    appId,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? undefined,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? undefined,
  };
}

export function getFirebaseClientApp(options?: {
  preferSameOriginAuthDomain?: boolean;
}) {
  if (getApps().length > 0) return getApp();
  return initializeApp(getFirebaseConfig(options));
}

export function getFirebaseClientAuth(options?: {
  preferSameOriginAuthDomain?: boolean;
}) {
  return getAuth(getFirebaseClientApp(options));
}
