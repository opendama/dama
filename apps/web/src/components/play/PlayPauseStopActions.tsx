"use client";

import { Button } from "@/components/ui/button";
import { pauseRemainingFromExpiresAt, pauseRemainingLine } from "@/lib/pause-remaining";
import { useEffect, useState } from "react";

type Props = {
  paused: boolean;
  pauseLabel?: string;
  pausePending?: boolean;
  pausePendingLabel?: string;
  onPause?: () => void;
  resumeLabel?: string;
  resumePending?: boolean;
  resumePendingLabel?: string;
  onResume?: () => void;
  stopLabel?: string;
  stopPending?: boolean;
  stopPendingLabel?: string;
  onStop?: () => void;
  pausedBlurb?: string;
  /** Server pause_remaining_ms when paused (used when expiry is unset). */
  pauseRemainingMs?: number;
  /** Server pause_expires_at_unix_ms for wall-clock countdown. */
  pauseExpiresAtUnixMs?: number;
  /** play_chrome.pause_remaining_fmt with `{time}` → m:ss. */
  pauseRemainingFmt?: string;
};

/** Pause (or Resume) beside Stop. Labels are chrome strings only. */
export function PlayPauseStopActions({
  paused,
  pauseLabel,
  pausePending,
  pausePendingLabel,
  onPause,
  resumeLabel,
  resumePending,
  resumePendingLabel,
  onResume,
  stopLabel,
  stopPending,
  stopPendingLabel,
  onStop,
  pausedBlurb,
  pauseRemainingMs = 0,
  pauseExpiresAtUnixMs = 0,
  pauseRemainingFmt,
}: Props) {
  const actionLabel = ((paused ? resumeLabel : pauseLabel) || "").trim();
  const stopText = (stopLabel || "").trim();
  const blurb = paused ? (pausedBlurb || "").trim() : "";
  const fmt = paused ? (pauseRemainingFmt || "").trim() : "";
  const onAction = paused ? onResume : onPause;
  const actionPendingLabel = ((paused ? resumePendingLabel : pausePendingLabel) || "").trim();
  const expires = Number(pauseExpiresAtUnixMs) || 0;

  const [remainingMs, setRemainingMs] = useState(() =>
    expires > 0 ? pauseRemainingFromExpiresAt(expires) : Math.max(0, pauseRemainingMs),
  );
  useEffect(() => {
    if (expires > 0) {
      setRemainingMs(pauseRemainingFromExpiresAt(expires));
      return;
    }
    setRemainingMs(Math.max(0, pauseRemainingMs));
  }, [expires, pauseRemainingMs]);
  useEffect(() => {
    if (!paused) return;
    const id = window.setInterval(() => {
      if (expires > 0) {
        setRemainingMs(pauseRemainingFromExpiresAt(expires));
        return;
      }
      setRemainingMs((prev) => Math.max(0, prev - 250));
    }, 250);
    return () => window.clearInterval(id);
  }, [paused, expires]);

  const remainingLine = paused ? pauseRemainingLine(fmt, remainingMs) : "";

  if (!actionLabel && !stopText && !blurb && !remainingLine) return null;

  return (
    <div className="space-y-2">
      {blurb ? <p className="text-xs text-[var(--dama-muted)]">{blurb}</p> : null}
      {remainingLine ? (
        <p className="text-xs font-medium tabular-nums text-[var(--dama-brand)] dark:text-[var(--dama-text)]">
          {remainingLine}
        </p>
      ) : null}
      {actionLabel || stopText ? (
        <div className="flex gap-2">
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant={paused ? "play" : "outline"}
              className="min-w-0 flex-1"
              disabled={Boolean(paused ? resumePending : pausePending)}
              isLoading={Boolean((paused ? resumePending : pausePending) && actionPendingLabel)}
              pendingLabel={actionPendingLabel}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
          {stopText && onStop ? (
            <Button
              type="button"
              variant="outline"
              className="min-w-0 flex-1"
              disabled={Boolean(stopPending)}
              isLoading={Boolean(stopPending && (stopPendingLabel || "").trim())}
              pendingLabel={(stopPendingLabel || "").trim()}
              onClick={onStop}
            >
              {stopText}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
