"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
let initialized = false;

function canUseMixpanel() {
  return typeof window !== "undefined" && Boolean(MIXPANEL_TOKEN);
}

export function initMixpanel() {
  if (!canUseMixpanel() || initialized) return false;

  mixpanel.init(MIXPANEL_TOKEN as string, {
    debug: process.env.NODE_ENV === "development",
    persistence: "localStorage",
    track_pageview: false,
  });
  mixpanel.register({
    app_name: "buckeclub",
  });
  initialized = true;
  return true;
}

export function trackMixpanelEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
) {
  if (!canUseMixpanel()) return;
  initMixpanel();
  mixpanel.track(eventName, properties);
}

export function trackMixpanelPageView(pathname: string) {
  if (!canUseMixpanel()) return;
  initMixpanel();

  mixpanel.track("Page Viewed", {
    pathname,
    search: window.location.search || "",
    url: window.location.href,
    page_title: document.title,
    locale: document.documentElement.lang || null,
  });
}

export function identifyMixpanelUser(
  distinctId: string,
  properties: Record<string, unknown> = {}
) {
  if (!canUseMixpanel()) return;
  initMixpanel();

  mixpanel.identify(distinctId);
  if (Object.keys(properties).length > 0) {
    mixpanel.register(properties);
  }
}

export function resetMixpanel() {
  if (!canUseMixpanel()) return;
  initMixpanel();
  mixpanel.reset();
}
