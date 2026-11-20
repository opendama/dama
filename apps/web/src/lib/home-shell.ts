/**
 * Home (`/`) play-shell flag: play hub / spectate use the Chess.com board|rail layout.
 *
 * When locked, marketing shell uses `h-dvh overflow-hidden` at all breakpoints so the
 * right rail body (`[data-dama-rail-scroll]`) is the scroller. Board host is height-budgeted
 * so PlayBoardColumn can fit top seat + board + bottom seat without clipping.
 *
 * Tournaments browse (Official|Community|All; legacy view=events) stays locked
 * (center column scrolls; rail stays). Full-page embeds (leaderboard,
 * matchmaking queue, status) unlock so lists can scroll.
 */
export function isHomeViewportLocked(searchParams: {
  get: (name: string) => string | null;
}): boolean {
  const view = (searchParams.get("view") || "").trim().toLowerCase();
  if (view === "leaderboard" || view === "status") return false;

  // Full matchmaking queue page (challenge/opponent stay in the play hub).
  if (view === "match") {
    const challenge = (searchParams.get("challenge") || "").trim();
    const opponent = (searchParams.get("opponent") || "").trim();
    if (!challenge && !opponent) return false;
  }

  return true;
}
