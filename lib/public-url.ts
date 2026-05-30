const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

function normalizeBaseUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function getPublicBaseUrl() {
  const configured = normalizeBaseUrl(configuredAppUrl ?? null);
  if (configured) return configured;

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }

  return null;
}

export function getAbsoluteAppUrl(path: string) {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}
