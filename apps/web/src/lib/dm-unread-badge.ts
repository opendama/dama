/** Telegram-style unread badge label from DB chrome (never invents "99+"). */
export function formatDmUnreadBadge(
  count: number,
  maxRaw: string | undefined,
  overflowFmt: string | undefined,
): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n <= 0) return "";
  const max = Number.parseInt(String(maxRaw || "").trim(), 10);
  const fmt = (overflowFmt || "").trim();
  if (!Number.isFinite(max) || max <= 0 || n <= max || !fmt.includes("{max}")) {
    return String(n);
  }
  return fmt.replaceAll("{max}", String(max));
}
