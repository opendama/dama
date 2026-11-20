/** Format pause countdown from server expiry / remaining ms using play_chrome.pause_remaining_fmt. */

export function formatPauseClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function applyPauseRemainingFmt(fmt: string, time: string): string {
  return fmt.split("{time}").join(time);
}

/** Remaining ms from absolute server pause_expires_at_unix_ms (0 when expired or unset). */
export function pauseRemainingFromExpiresAt(expiresAtUnixMs: number, nowMs = Date.now()): number {
  const expires = Number(expiresAtUnixMs) || 0;
  if (expires <= 0) return 0;
  return Math.max(0, expires - nowMs);
}

export function pauseRemainingLine(fmt: string | undefined, remainingMs: number): string {
  const template = (fmt || "").trim();
  if (!template || remainingMs <= 0) return "";
  return applyPauseRemainingFmt(template, formatPauseClock(remainingMs)).trim();
}
