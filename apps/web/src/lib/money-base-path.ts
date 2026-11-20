/** Portal money prefix from a DB href (`/events/wallet`, `/ads/wallet`, …). Empty = player. */
export function moneyBasePathFromHref(href: string): string {
  const raw = (href || "").trim();
  if (!raw) return "";
  try {
    const path = new URL(raw, "http://local.invalid").pathname;
    if (path === "/events" || path.startsWith("/events/")) return "/events";
    if (path === "/ads" || path.startsWith("/ads/")) return "/ads";
  } catch {
    return "";
  }
  return "";
}
