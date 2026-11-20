"use client";

import { useEffect, useRef } from "react";

/**
 * Reset list skip when filter/search deps change - not on the initial mount.
 * Pair with useUrlSkip so refresh can restore `?skip=` / namespaced skip params.
 *
 * Important: React Strict Mode (dev) re-runs effects once with the same deps.
 * A boolean "mounted" latch would treat that re-run as a filter change and
 * call setSkip(0), wiping URL skip after refresh. Compare serialized keys instead.
 */
export function useResetSkipOnChange(
  setSkip: (next: number) => void,
  deps: ReadonlyArray<unknown>,
): void {
  const setSkipRef = useRef(setSkip);
  setSkipRef.current = setSkip;
  const key = deps.map((d) => String(d ?? "")).join("\u0001");
  const prevKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevKeyRef.current;
    if (prev === null) {
      prevKeyRef.current = key;
      return;
    }
    // Same key: Strict Mode effect re-run or unrelated parent re-render - keep skip.
    if (prev === key) return;
    prevKeyRef.current = key;
    setSkipRef.current(0);
  }, [key]);
}
