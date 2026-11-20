"use client";

import { useEffect, useState } from "react";

/** Debounce a value for live search (Trim data-table parity: fires after delayMs). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const ms = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0;
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
