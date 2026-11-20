import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { authHeaders, restClient } from "@/lib/api";
import { ApiClientError } from "@/lib/api-client-error";
import {
  clearStoredPlaySession,
  patchStoredPlayPaused,
  readStoredPlaySession,
  storePlaySession,
} from "@/lib/play-session-storage";
import type { GamePayload } from "@/types/game";
import type { QueryClient } from "@tanstack/react-query";

/** True when the match already has a decisive/draw result (leave-pause must no-op). */
export function isGameFinishedPayload(game: GamePayload | null | undefined): boolean {
  if (!game) return false;
  return game.outcome != null || game.draw === true;
}

/** Leave-pause errors that must not toast (match ended / wrong seat / auth / OTP). */
export function isLeavePauseSilentError(errorKey: string): boolean {
  const key = errorKey.trim().toLowerCase();
  return (
    key === "game_finished" ||
    key === "not_a_seat" ||
    key === "unauthorized" ||
    key === "err_unauthorized" ||
    key === "err_verification_required" ||
    key === "err_verification_unavailable"
  );
}

/** Optional QueryClient so leave-pause keeps board cache coherent for nav-back. */
let pauseQueryClient: QueryClient | null = null;

export function bindPauseQueryClient(qc: QueryClient | null): void {
  pauseQueryClient = qc;
}

const pauseInflight = new Set<string>();

let activeBoardGameId: string | null = null;
const activeBoardListeners = new Set<() => void>();

let manualResume = false;

export function markManualResume(): void {
  manualResume = true;
}

/** True once after a seated Resume click, then clears. Auto-resume toasts skip that turn. */
export function takeManualResume(): boolean {
  const pending = manualResume;
  manualResume = false;
  return pending;
}

export function setActivePlayBoardGameId(gameId: string | null): void {
  const next = (gameId || "").trim() || null;
  if (activeBoardGameId === next) return;
  activeBoardGameId = next;
  for (const listener of activeBoardListeners) listener();
}

export function getActivePlayBoardGameId(): string | null {
  return activeBoardGameId;
}

export function subscribeActivePlayBoard(listener: () => void): () => void {
  activeBoardListeners.add(listener);
  return () => {
    activeBoardListeners.delete(listener);
  };
}

export function isPauseInflight(gameId: string): boolean {
  return pauseInflight.has(gameId.trim());
}

/**
 * Legacy helper: body English must never invent keys.
 * Prefer REST `error_key`; return empty when absent (clients use toast_* chrome).
 */
export function pauseErrorKeyFromBody(_error: string): string {
  return "";
}

type PauseChromeSlice = {
  pause_disabled?: string;
  err_pause_disabled?: string;
  err_already_paused?: string;
  err_not_paused?: string;
  err_game_paused?: string;
  err_officially_paused?: string;
  toast_pause_failed?: string;
  toast_resume_failed?: string;
};

/** Chrome string for a pause/resume failure. Empty when chrome has no copy. */
export function pauseFailureLabel(
  chrome: PauseChromeSlice | null | undefined,
  errorKey: string,
  kind: "pause" | "resume",
): string {
  const key = errorKey.trim();
  let specific = "";
  if (key === "pause_disabled") {
    specific = (chrome?.pause_disabled || chrome?.err_pause_disabled || "").trim();
  } else if (key === "already_paused") {
    specific = (chrome?.err_already_paused || "").trim();
  } else if (key === "not_paused") {
    specific = (chrome?.err_not_paused || "").trim();
  } else if (key === "game_paused" || key === "err_game_paused") {
    specific = (chrome?.err_game_paused || "").trim();
  } else if (key === "err_officially_paused") {
    specific = (chrome?.err_officially_paused || "").trim();
  }
  if (specific) return specific;
  const fallback = kind === "resume" ? chrome?.toast_resume_failed : chrome?.toast_pause_failed;
  return (fallback || "").trim();
}

async function postGameAction(
  token: string,
  gameId: string,
  action: "pause" | "resume",
): Promise<GamePayload> {
  if (!token) throw new ApiClientError("", { errorKey: "unauthorized" });
  const id = gameId.trim();
  if (!id) throw new ApiClientError("", { errorKey: "http_400" });
  const res = await restClient.post<GamePayload & { error?: string; error_key?: string }>(
    `/games/${id}/${action}`,
    {},
    {
      headers: authHeaders(token),
      // 409 is writePlayPausedErr (officially/player paused rejects).
      validateStatus: (status) =>
        status === 400 || status === 409 || (status >= 200 && status < 300),
    },
  );
  if (res.status === 400 || res.status === 409) {
    const bodyKey = typeof res.data?.error_key === "string" ? res.data.error_key.trim() : "";
    const errorKey =
      bodyKey || pauseErrorKeyFromBody(typeof res.data?.error === "string" ? res.data.error : "");
    // Fail closed: never invent http_400; empty key → toast_* chrome only.
    throw new ApiClientError("", {
      status: res.status,
      errorKey,
    });
  }
  return res.data;
}

export function postGamePause(token: string, gameId: string): Promise<GamePayload> {
  return postGameAction(token, gameId, "pause");
}

export async function postGameResume(token: string, gameId: string): Promise<GamePayload> {
  const payload = await postGameAction(token, gameId, "resume");
  if (payload?.id && pauseQueryClient) {
    pauseQueryClient.setQueryData(gameStateQueryKey(payload.id), payload);
  }
  return payload;
}

/**
 * Pause a live match when the player leaves the board.
 * Marks the stored session paused immediately and reverts if the request fails.
 * No-ops when a pause for this id is already in flight or the session is not a live unpaused game.
 */
export async function pauseGameOnLeave(
  token: string,
  gameId: string,
  mode?: string,
): Promise<GamePayload | null> {
  const id = gameId.trim();
  if (!token || !id || pauseInflight.has(id)) return null;
  const session = readStoredPlaySession();
  if (session && session.gameId !== id) return null;
  if (session && (session.phase !== "playing" || session.paused)) return null;
  // Cached finished board: never POST pause / never toast.
  const cached = pauseQueryClient?.getQueryData<GamePayload>(gameStateQueryKey(id));
  // Official pause: players cannot leave-pause or clear it.
  if (cached?.paused && (cached.pause_kind || "").trim() === "official") return null;
  if (isGameFinishedPayload(cached) || session?.phase === "finished") {
    storePlaySession({
      gameId: id,
      mode: (session?.mode || mode || "ai").trim() || "ai",
      phase: "finished",
      updatedAt: new Date().toISOString(),
    });
    return null;
  }
  pauseInflight.add(id);
  if (!session) {
    storePlaySession({
      gameId: id,
      mode: mode || "ai",
      phase: "playing",
      paused: true,
      updatedAt: new Date().toISOString(),
    });
  } else {
    patchStoredPlayPaused(true);
  }
  try {
    const payload = await postGamePause(token, id);
    if (isGameFinishedPayload(payload)) {
      storePlaySession({
        gameId: id,
        mode: (payload.mode || mode || "ai").trim() || "ai",
        phase: "finished",
        updatedAt: new Date().toISOString(),
      });
      if (payload.id) {
        pauseQueryClient?.setQueryData(gameStateQueryKey(payload.id), payload);
      }
      return null;
    }
    const expires = Number(payload.pause_expires_at_unix_ms) || 0;
    const kind = (payload.pause_kind || "").trim() || undefined;
    patchStoredPlayPaused(true, expires > 0 ? expires : undefined, kind);
    if (payload?.id && pauseQueryClient) {
      pauseQueryClient.setQueryData(gameStateQueryKey(payload.id), payload);
    }
    return payload;
  } catch (err) {
    const key = err instanceof ApiClientError ? err.errorKey || "" : "";
    // Race: board flipped to official while leave-pause was in flight. Keep session;
    // mark official so FAB hides and clocks stay frozen (do not clearStoredPlaySession).
    if (key === "err_officially_paused") {
      patchStoredPlayPaused(true, 0, "official");
      return null;
    }
    if (isLeavePauseSilentError(key)) {
      // Finished / wrong seat: drop live session so leave stops retry-toasting.
      // OTP/auth: keep session (user can verify and resume); do not clear.
      const otpOrAuth =
        key === "unauthorized" ||
        key === "err_unauthorized" ||
        key === "err_verification_required" ||
        key === "err_verification_unavailable";
      if (!otpOrAuth) {
        const existing = readStoredPlaySession();
        if (existing?.gameId === id) {
          if (key === "game_finished") {
            storePlaySession({
              gameId: id,
              mode: existing.mode || mode || "ai",
              phase: "finished",
              updatedAt: new Date().toISOString(),
            });
          } else {
            clearStoredPlaySession();
          }
        }
      } else {
        patchStoredPlayPaused(false);
      }
      return null;
    }
    patchStoredPlayPaused(false);
    throw err;
  } finally {
    pauseInflight.delete(id);
  }
}
