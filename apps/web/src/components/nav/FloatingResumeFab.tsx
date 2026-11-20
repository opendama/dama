"use client";

import { Button } from "@/components/ui/button";
import { usePlayChromeQuery } from "@/hooks/query/usePlayChromeQuery";
import { useClientMounted } from "@/hooks/useClientMounted";
import { authHeaders, restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import {
  getActivePlayBoardGameId,
  markManualResume,
  pauseFailureLabel,
  postGameResume,
  subscribeActivePlayBoard,
  takeManualResume,
} from "@/lib/pause-active-game";
import { pauseRemainingFromExpiresAt, pauseRemainingLine } from "@/lib/pause-remaining";
import {
  PLAY_SESSION_EVENT,
  type StoredPlaySession,
  buildPlayResumeHref,
  clearStoredPlaySession,
  isPlayBoardUrl,
  isPlayerPlaySurface,
  patchStoredPlayPaused,
  readStoredPlaySession,
} from "@/lib/play-session-storage";
import { ensurePracticeToken, readPracticeToken } from "@/lib/practice-token";
import { useAuthStore } from "@/store/auth";
import type { GamePayload } from "@/types/game";
import { isPlayChromeReady } from "@/types/play-chrome";
import { Play } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

function useStoredPlaySession(): StoredPlaySession | null {
  const [session, setSession] = useState<StoredPlaySession | null>(null);
  useEffect(() => {
    const tick = () => setSession(readStoredPlaySession());
    tick();
    window.addEventListener(PLAY_SESSION_EVENT, tick);
    window.addEventListener("focus", tick);
    return () => {
      window.removeEventListener(PLAY_SESSION_EVENT, tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return session;
}

function usePauseCountdownMs(expiresAtUnixMs?: number): number {
  const expires = Number(expiresAtUnixMs) || 0;
  const [remainingMs, setRemainingMs] = useState(() => pauseRemainingFromExpiresAt(expires));
  useEffect(() => {
    setRemainingMs(pauseRemainingFromExpiresAt(expires));
    if (expires <= 0) return;
    const id = window.setInterval(() => {
      setRemainingMs(pauseRemainingFromExpiresAt(expires));
    }, 250);
    return () => window.clearInterval(id);
  }, [expires]);
  return remainingMs;
}

/**
 * Brand resume control shown on every shell when a match is paused and this
 * screen is not that match's board. Desktop and mobile.
 */
export function FloatingResumeFab() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const authToken = useAuthStore((s) => s.token);
  const mounted = useClientMounted();
  const session = useStoredPlaySession();
  const remainingMs = usePauseCountdownMs(session?.pauseExpiresAtUnixMs);
  const activeBoardId = useSyncExternalStore(
    subscribeActivePlayBoard,
    getActivePlayBoardGameId,
    () => null,
  );
  const chromeQuery = usePlayChromeQuery(true);
  const chrome = isPlayChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const [practiceToken, setPracticeToken] = useState<string | null>(null);
  const mode = (session?.mode || "ai").toLowerCase();
  const needsPractice = mode !== "pvp";

  useEffect(() => {
    if (!session?.paused || !needsPractice || authToken) return;
    const existing = readPracticeToken();
    if (existing) {
      setPracticeToken(existing);
      return;
    }
    let cancelled = false;
    void ensurePracticeToken().then((t) => {
      if (!cancelled) setPracticeToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, [authToken, needsPractice, session?.paused]);

  const token = useMemo(() => {
    const auth = (authToken || "").trim();
    if (auth) return auth;
    if (!needsPractice) return "";
    return (practiceToken || readPracticeToken() || "").trim();
  }, [authToken, needsPractice, practiceToken]);

  const [resumePending, setResumePending] = useState(false);
  const [expiryRetryTick, setExpiryRetryTick] = useState(0);
  const expirySyncRef = useRef("");
  const expiryRetryRef = useRef(0);

  // Authoritative sync while paused (player or official): rematch/forfeit/resume must clear session.
  useEffect(() => {
    if (!session?.paused || !session.gameId || !token) return;
    let cancelled = false;
    const syncPaused = async () => {
      try {
        const { data } = await restClient.get<GamePayload>(
          `/games/${encodeURIComponent(session.gameId)}/state`,
          { headers: authHeaders(token) },
        );
        if (cancelled || !data) return;
        if (data.outcome != null || data.draw === true || !data.paused) {
          clearStoredPlaySession();
          return;
        }
        const kind = (data.pause_kind || "").trim();
        if (kind === "official") {
          patchStoredPlayPaused(true, 0, "official");
        }
      } catch {
        // Fail closed: leave FAB until expiry sync or next focus.
      }
    };
    void syncPaused();
    const onVis = () => {
      if (document.visibilityState === "visible") void syncPaused();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session?.gameId, session?.paused, token]);

  // When admin pause duration elapses, sweeper resumes server-side; drop FAB after confirm.
  useEffect(() => {
    if (!session?.paused || !session.gameId || !token) return;
    const expires = Number(session.pauseExpiresAtUnixMs) || 0;
    if (expires <= 0 || remainingMs > 0) return;
    const key = `${session.gameId}:${expires}:${expiryRetryTick}`;
    if (expirySyncRef.current === key) return;
    expirySyncRef.current = key;
    let cancelled = false;
    const scheduleRetry = () => {
      if (cancelled) return;
      window.clearTimeout(expiryRetryRef.current);
      expiryRetryRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setExpiryRetryTick((n) => n + 1);
      }, 3000);
    };
    void (async () => {
      try {
        const { data } = await restClient.get<GamePayload>(
          `/games/${encodeURIComponent(session.gameId)}/state`,
          { headers: authHeaders(token) },
        );
        if (cancelled) return;
        if (!data?.paused) {
          patchStoredPlayPaused(false);
          const msg = (chrome?.toast_auto_resumed || "").trim();
          if (msg) toast.message(msg);
          return;
        }
        const kind = (data.pause_kind || "").trim() || undefined;
        // Official pause: drop floating player Resume (cannot clear).
        if (kind === "official") {
          patchStoredPlayPaused(true, undefined, kind);
          return;
        }
        const nextExpires = Number(data.pause_expires_at_unix_ms) || 0;
        if (nextExpires > Date.now()) {
          patchStoredPlayPaused(true, nextExpires, kind);
          return;
        }
        // Still paused but expiry already elapsed: sweeper lag - retry (Flutter parity).
        scheduleRetry();
      } catch {
        scheduleRetry();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(expiryRetryRef.current);
    };
  }, [chrome?.toast_auto_resumed, expiryRetryTick, remainingMs, session, token]);

  if (!mounted || typeof document === "undefined") return null;
  if (!session || session.phase !== "playing" || !session.paused || !session.gameId) return null;
  // Official pauses: players cannot resume; hide the floating Resume FAB.
  if ((session.pauseKind || "").trim() === "official") return null;
  // On-board only when the URL is that match (or the seated hub claims it while on play surface).
  if (isPlayBoardUrl(pathname, searchParams, session.gameId)) return null;
  if (activeBoardId === session.gameId && isPlayerPlaySurface(pathname, searchParams)) {
    return null;
  }
  // Fail-closed: no unlabeled brand control while chrome is loading/unavailable.
  if (!chrome) return null;

  const label = (chrome.floating_resume_label || "").trim();
  const aria = (chrome.floating_resume_aria || "").trim();
  const pendingLabel = (chrome.resume_game_pending || "").trim();
  const remainingLine = pauseRemainingLine(chrome.pause_remaining_fmt, remainingMs);
  if (!label && !aria) return null;

  const go = () => {
    router.push(buildPlayResumeHref(session.gameId, session.mode));
  };

  return createPortal(
    <div
      className="fixed right-4 z-50 flex flex-col items-end gap-1"
      style={{
        bottom:
          "calc(var(--dama-bottom-nav-height, 0px) + 0.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {remainingLine ? (
        <p className="rounded-full border border-[var(--dama-border)] bg-[var(--dama-card)] px-3 py-1 text-xs font-semibold tabular-nums text-[var(--dama-brand)] shadow-sm dark:text-[var(--dama-text)]">
          {remainingLine}
        </p>
      ) : null}
      <Button
        type="button"
        variant="play"
        className="h-12 rounded-full px-4 shadow-lg"
        aria-label={aria || label || undefined}
        disabled={resumePending}
        isLoading={resumePending && Boolean(pendingLabel)}
        pendingLabel={pendingLabel}
        onClick={() => {
          void (async () => {
            if (resumePending) return;
            let access = token;
            if (!access && needsPractice) {
              access = (await ensurePracticeToken()) || "";
              if (access) setPracticeToken(access);
            }
            // Never open the board without a successful server resume.
            if (!access) {
              const msg = pauseFailureLabel(chrome, "", "resume");
              if (msg) toast.error(msg);
              return;
            }
            setResumePending(true);
            markManualResume();
            try {
              await postGameResume(access, session.gameId);
              patchStoredPlayPaused(false);
              const msg = (chrome.toast_resumed || "").trim();
              if (msg) toast.success(msg);
              go();
            } catch (err) {
              takeManualResume();
              const key = isApiClientError(err) ? err.errorKey || "" : "";
              const msg = pauseFailureLabel(chrome, key, "resume");
              if (msg) toast.error(msg);
            } finally {
              setResumePending(false);
            }
          })();
        }}
      >
        <Play className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Button>
    </div>,
    document.body,
  );
}
