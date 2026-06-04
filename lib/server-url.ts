import { headers } from "next/headers";

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

function normalizeBaseUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export async function getServerBaseUrl() {
  const configured = normalizeBaseUrl(configuredAppUrl ?? null);
  if (configured) return configured;

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) return null;

  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return normalizeBaseUrl(`${proto}://${host}`);
}
