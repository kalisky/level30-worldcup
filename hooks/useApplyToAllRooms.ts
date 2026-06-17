"use client";

import { useSyncExternalStore } from "react";

// Whether a new/edited bet should also be applied to the user's other rooms.
// Module-level so every mounted bet card shares one value, persisted to
// localStorage so the choice sticks across navigations and reloads. Defaults
// to ON: most multi-room users want the same bet everywhere.
const STORAGE_KEY = "wc:applyToAllRooms";

let value = true;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "0") value = false;
  else if (stored === "1") value = true;
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApplyToAllRooms() {
  hydrate();
  return value;
}

export function setApplyToAllRooms(next: boolean) {
  value = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }
  for (const listener of listeners) listener();
}

/** Reactive read of the shared toggle. Server snapshot is the ON default. */
export function useApplyToAllRooms() {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => true
  );
}
