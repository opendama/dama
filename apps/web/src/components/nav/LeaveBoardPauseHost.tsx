"use client";

import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { useProgressionQuery } from "@/hooks/query/useProgressionQuery";
import { isApiClientError } from "@/lib/api-client-error";
import {
  isLeavePauseSilentError,
  pauseFailureLabel,
  pauseGameOnLeave,
} from "@/lib/pause-active-game";
import { isPlayerPlaySurface, readStoredPlaySession } from "@/lib/play-session-storage";
import { ensurePracticeToken, readPracticeToken } from "@/lib/practice-token";
import { useAuthStore } from "@/store/auth";
import { isPlayChromeReady } from "@/types/play-chrome";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

/** Latest mounted host's play-surface bit (Strict Mode / layout remount safe). */
let latestOnPlaySurface = false;

/**
 * Desktop + mobile: pause the live match when leaving the play board surface.
 * BottomNav is md:hidden, so leave-pause cannot live there. HomePlayHub also
 * unmounts embedded AI on browse-away views in the same render; this host covers
 * shell/layout transitions and desktop left-nav leave.
 *
 * Does not gate on activeBoardGameId (keep-alive / late unmount can still claim it).
 */
export function LeaveBoardPauseHost() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const playChromeQuery = usePlayChromeQuery(true);
  const progressionQuery = useProgressionQuery();
  const playChrome = isPlayChromeReady(playChromeQuery.data) ? playChromeQuery.data : undefined;

  const onPlayPage = isPlayerPlaySurface(pathname, searchParams);
  const playSurfaceRef = useRef(onPlayPage);
  const prevPlaySurfaceRef = useRef(onPlayPage);
  const tokenRef = useRef(token);
  const pauseChromeRef = useRef(playChrome);
  const pauseEnabledRef = useRef(false);
  tokenRef.current = token;
  pauseChromeRef.current = playChrome;
  playSurfaceRef.current = onPlayPage;
  latestOnPlaySurface = onPlayPage;
  // Fail-closed: only auto-pause when DB match_clock.pause_enabled is explicitly true.
  pauseEnabledRef.current = progressionQuery.data?.match_clock?.pause_enabled === true;

  const pauseIfLeftBoard = useCallback(() => {
    if (!pauseEnabledRef.current) return;
    const session = readStoredPlaySession();
    if (!session || session.phase !== "playing" || session.paused || !session.gameId) return;
    // Official pause already freezes the board; do not attempt a player leave-pause.
    if ((session.pauseKind || "").trim() === "official") return;
    const mode = session.mode;
    const gameId = session.gameId;
    void (async () => {
      let access = (tokenRef.current || readPracticeToken() || "").trim();
      if (!access) {
        access = ((await ensurePracticeToken()) || "").trim();
      }
      if (!access) return;
      try {
        const payload = await pauseGameOnLeave(access, gameId, mode);
        if (!payload) return;
        const msg = (pauseChromeRef.current?.toast_paused || "").trim();
        if (msg) toast.success(msg);
      } catch (err: unknown) {
        const key = isApiClientError(err) ? err.errorKey || "" : "";
        if (isLeavePauseSilentError(key)) return;
        const msg = pauseFailureLabel(pauseChromeRef.current, key, "pause");
        if (msg) toast.error(msg);
      }
    })();
  }, []);

  useEffect(() => {
    const now = isPlayerPlaySurface(pathname, searchParams);
    const was = prevPlaySurfaceRef.current;
    prevPlaySurfaceRef.current = now;
    if (was && !now) pauseIfLeftBoard();
  }, [pathname, searchParams, pauseIfLeftBoard]);

  useEffect(() => {
    return () => {
      const wasOnPlay = playSurfaceRef.current;
      window.setTimeout(() => {
        if (!wasOnPlay) return;
        // Another mount still on the play surface (Strict Mode / soft remount).
        if (latestOnPlaySurface) return;
        pauseIfLeftBoard();
      }, 0);
    };
  }, [pauseIfLeftBoard]);

  return null;
}
