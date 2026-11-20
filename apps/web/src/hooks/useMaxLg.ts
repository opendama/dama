"use client";

import { useSyncExternalStore } from "react";

/** Tailwind `lg` - true below 1024px (phone + tablet). */
const MAX_LG_MQ = "(max-width: 1023px)";

function subscribeMaxLg(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mq = window.matchMedia(MAX_LG_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getMaxLgSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(MAX_LG_MQ).matches;
}

function getMaxLgServerSnapshot() {
  // SSR assumes desktop freeze layout; client swaps to compact scroll after mount.
  return false;
}

/** Phone / tablet viewport (below Tailwind `lg`). */
export function useMaxLg(): boolean {
  return useSyncExternalStore(subscribeMaxLg, getMaxLgSnapshot, getMaxLgServerSnapshot);
}
