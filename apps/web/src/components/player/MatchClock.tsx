"use client";

import { useEffect, useRef, useState } from "react";

export type ServerMatchClockArgs = {
  gameKey: string;
  enabled: boolean;
  /** Authoritative remaining for seat 1 at last server sync (ms). */
  p1RemainingMs: number;
  /** Authoritative remaining for seat 2 at last server sync (ms). */
  p2RemainingMs: number;
  /** Server wall clock at payload time (ms). */
  serverNowMs: number;
  turn: number;
  running: boolean;
  /** Server pause: show the last authoritative remaining and do not tick. */
  paused?: boolean;
  /** Fired once when the active seat's displayed clock hits 0 (server validates). */
  onFlag?: () => void;
};

function formatClockMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Dual seat clocks driven by server remaining + local interpolation between syncs.
 * Call once per board; pass `p1Label` / `p2Label` into the matching seats.
 */
export function useServerMatchClocks({
  gameKey,
  enabled,
  p1RemainingMs,
  p2RemainingMs,
  serverNowMs,
  turn,
  running,
  paused = false,
  onFlag,
}: ServerMatchClockArgs): { p1Label: string | null; p2Label: string | null } {
  const [p1Ms, setP1Ms] = useState(p1RemainingMs);
  const [p2Ms, setP2Ms] = useState(p2RemainingMs);
  const syncWallRef = useRef(Date.now());
  const flaggedRef = useRef(false);
  const onFlagRef = useRef(onFlag);
  onFlagRef.current = onFlag;

  // Resync from authoritative server snapshot.
  // gameKey/serverNowMs/paused intentionally force resync even when remaining ms are unchanged.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gameKey + serverNowMs are sync triggers, not read values
  useEffect(() => {
    setP1Ms(Math.max(0, p1RemainingMs));
    setP2Ms(Math.max(0, p2RemainingMs));
    syncWallRef.current = Date.now();
    flaggedRef.current = false;
  }, [gameKey, p1RemainingMs, p2RemainingMs, serverNowMs, paused]);

  useEffect(() => {
    if (!enabled || !running || paused) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - syncWallRef.current;
      setP1Ms((prev) => {
        if (turn !== 1) return prev;
        return Math.max(0, p1RemainingMs - elapsed);
      });
      setP2Ms((prev) => {
        if (turn !== 2) return prev;
        return Math.max(0, p2RemainingMs - elapsed);
      });
      const active =
        turn === 1
          ? Math.max(0, p1RemainingMs - elapsed)
          : turn === 2
            ? Math.max(0, p2RemainingMs - elapsed)
            : 1;
      if (active <= 0 && !flaggedRef.current) {
        flaggedRef.current = true;
        onFlagRef.current?.();
        // Premature client tick can be rejected; allow another claim after sync window.
        window.setTimeout(() => {
          flaggedRef.current = false;
        }, 2000);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [enabled, running, paused, turn, p1RemainingMs, p2RemainingMs]);

  if (!enabled) return { p1Label: null, p2Label: null };
  return {
    p1Label: formatClockMs(p1Ms),
    p2Label: formatClockMs(p2Ms),
  };
}

/** Static TC label only (lobby/preview). Does not tick - live boards use useServerMatchClocks. */
export function useMatchClock({
  enabled,
  initialSeconds,
}: {
  gameKey?: string;
  enabled: boolean;
  initialSeconds: number;
  incrementSeconds?: number;
  moveCount?: number;
  running?: boolean;
}): string | null {
  if (!enabled || !(initialSeconds > 0)) return null;
  return formatClockMs(initialSeconds * 1000);
}

type MatchClockChrome = {
  clockPrefix: string;
  labelValueSeparator: string;
  incrementSuffix: string;
  incrementParenOpen: string;
  parenClose: string;
};

type Props = {
  gameKey: string;
  enabled: boolean;
  initialSeconds: number;
  incrementSeconds: number;
  moveCount: number;
  running: boolean;
  variant?: "full" | "badge";
} & MatchClockChrome;

/** Static match-clock badge/label (lobby). Live boards must use useServerMatchClocks. */
export function MatchClock({
  enabled,
  initialSeconds,
  incrementSeconds,
  clockPrefix,
  labelValueSeparator,
  incrementSuffix,
  incrementParenOpen,
  parenClose,
  variant = "full",
}: Props) {
  const badge = useMatchClock({
    enabled,
    initialSeconds,
  });

  if (badge == null) return null;
  if (variant === "badge") {
    return <span className="font-mono tabular-nums">{badge}</span>;
  }
  if (
    !clockPrefix.trim() ||
    !labelValueSeparator ||
    !incrementSuffix.trim() ||
    !incrementParenOpen.trim() ||
    !parenClose.trim()
  ) {
    return null;
  }

  return (
    <p className="font-mono text-sm tabular-nums">
      {clockPrefix}
      {labelValueSeparator}
      {badge}
      {incrementSeconds > 0
        ? `${incrementParenOpen}${incrementSeconds}${incrementSuffix}${parenClose}`
        : ""}
    </p>
  );
}
