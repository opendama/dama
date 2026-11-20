/** Parse DB chrome search_debounce_ms. Returns 0 when missing/invalid (fail closed). */
export function parseSearchDebounceMs(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
