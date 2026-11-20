/** DB `live_player_name_max_chars` + `name_truncate_suffix` (fail closed: no invent). */
export function formatPlayerNameDisplay(name: string, charsRaw: string, suffix: string): string {
  const n = Number.parseInt(charsRaw.trim(), 10);
  const trimmed = name.trim();
  if (!Number.isFinite(n) || n <= 0) return trimmed;
  if (trimmed.length <= n) return trimmed;
  return `${trimmed.slice(0, n)}${suffix}`;
}

/** Parse chrome `search_debounce_ms` (DB only). Callers mount only when chrome is ready. */
export function parseSearchDebounceMs(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("search_debounce_ms invalid");
  }
  return n;
}
