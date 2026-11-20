/** Dedicated public player profile route (opens in new tab from lists/popovers). */
export function playerProfileHref(playerId: string): string {
  const id = playerId.trim();
  if (!id) return "";
  return `/players/${encodeURIComponent(id)}`;
}
