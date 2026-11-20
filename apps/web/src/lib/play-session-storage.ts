/** Active play resume (smart-menu GuestGameSession pattern). */

const KEY = "dama-active-play";

export const PLAY_RESUME_PARAM = "resume";

/** Fired after sessionStorage writes so nav / resume FAB update without waiting on the poll. */
export const PLAY_SESSION_EVENT = "dama-play-session";

export type StoredPlaySession = {
  gameId: string;
  mode: string;
  phase: "playing" | "finished";
  /** Set when the seated player froze the match (or the server reports it paused). */
  paused?: boolean;
  /** Server pause_expires_at_unix_ms for floating countdown while browsing. */
  pauseExpiresAtUnixMs?: number;
  /** Server pause_kind; official pauses must not use the floating player Resume FAB. */
  pauseKind?: string;
  updatedAt: string;
};

function emitPlaySession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAY_SESSION_EVENT));
}

export function readStoredPlaySession(): StoredPlaySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPlaySession;
    if (!parsed.gameId?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storePlaySession(session: StoredPlaySession): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
  emitPlaySession();
}

export function clearStoredPlaySession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  emitPlaySession();
}

/** Keep phase/mode and flip the paused flag on the current playing session. */
export function patchStoredPlayPaused(
  paused: boolean,
  pauseExpiresAtUnixMs?: number,
  pauseKind?: string,
): void {
  const current = readStoredPlaySession();
  if (!current || current.phase !== "playing") return;
  const nextExpires = paused ? (pauseExpiresAtUnixMs ?? current.pauseExpiresAtUnixMs) : undefined;
  const nextKind = paused ? (pauseKind ?? current.pauseKind ?? "").trim() || undefined : undefined;
  const samePaused = Boolean(current.paused) === paused;
  const sameExpires = (current.pauseExpiresAtUnixMs || 0) === (nextExpires || 0);
  const sameKind = (current.pauseKind || "") === (nextKind || "");
  if (samePaused && sameExpires && sameKind) return;
  storePlaySession({
    ...current,
    paused,
    pauseExpiresAtUnixMs: nextExpires,
    pauseKind: nextKind,
    updatedAt: new Date().toISOString(),
  });
}

const NON_PLAY_HOME_VIEWS = new Set([
  "leaderboard",
  "spectate",
  "status",
  "tournaments",
  "events",
  "match",
]);

/** Home play hub, legacy /play, or a resumed board. Browse/spectate/matchmaking views are not the board. */
export function isPlayerPlaySurface(
  pathname: string,
  search: { get(name: string): string | null },
): boolean {
  if (pathname === "/play" || pathname.startsWith("/play/")) return true;
  // Legacy player play redirect hops through /player/play before landing on /.
  if (pathname === "/player/play" || pathname.startsWith("/player/play/")) return true;
  if (pathname !== "/") return false;
  const view = (search.get("view") || "").trim().toLowerCase();
  if (!view || view === "play") return true;
  if (view === "match") {
    const challenge = (search.get("challenge") || "").trim();
    const opponent = (search.get("opponent") || "").trim();
    return Boolean(challenge || opponent);
  }
  return !NON_PLAY_HOME_VIEWS.has(view);
}

/** URL already points at this game's play board (`/?gameId=`), not spectate or other home views. */
export function isPlayBoardUrl(
  pathname: string,
  search: { get(name: string): string | null },
  gameId: string,
): boolean {
  const id = gameId.trim();
  if (!id || !isPlayerPlaySurface(pathname, search)) return false;
  const q = (search.get("gameId") || search.get("game_id") || "").trim();
  return q === id;
}

export function buildPlayResumeHref(gameId: string, mode?: string): string {
  const m = (mode || "ai").toLowerCase() === "pvp" ? "pvp" : "ai";
  return `/?gameId=${encodeURIComponent(gameId)}&${PLAY_RESUME_PARAM}=1&mode=${m}`;
}
