"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

export type ChartFloatTip = {
  /** Stable id so re-tapping the same slice/day toggles closed. */
  key: string;
  x: number;
  y: number;
  body: ReactNode;
};

function isFinePointer(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Heatmap-style float tips for Recharts: fixed overlay (not controlled Tooltip).
 * Desktop = hover; touch = sticky tap; outside pointerdown dismisses.
 * Avoids Recharts controlled `active`/`payload` which flash/clear on mobile.
 */
export function useChartFloatTip() {
  const [tip, setTip] = useState<ChartFloatTip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);

  const clear = useCallback(() => setTip(null), []);

  const openAt = useCallback((key: string, x: number, y: number, body: ReactNode) => {
    openedAtRef.current = Date.now();
    setTip((prev) => {
      if (prev?.key === key) return null;
      return { key, x, y, body };
    });
  }, []);

  /** Desktop hover: always replace (no toggle). */
  const hoverAt = useCallback((key: string, x: number, y: number, body: ReactNode) => {
    if (!isFinePointer()) return;
    setTip({ key, x, y, body });
  }, []);

  /** Touch/pen tap: toggle sticky tip. */
  const tapAt = useCallback(
    (key: string, x: number, y: number, body: ReactNode) => {
      if (isFinePointer()) return;
      openAt(key, x, y, body);
    },
    [openAt],
  );

  const onFineLeave = useCallback(() => {
    if (isFinePointer()) setTip(null);
  }, []);

  useEffect(() => {
    if (!tip) return;
    const onDown = (e: PointerEvent) => {
      // Ignore the same gesture that opened the tip.
      if (Date.now() - openedAtRef.current < 80) return;
      const root = wrapRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setTip(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [tip]);

  return {
    tip,
    wrapRef,
    clear,
    /** Always toggle tip (legend chips / keyboard). */
    showAt: openAt,
    hoverAt,
    tapAt,
    onFineLeave,
    isFinePointer,
  };
}

/** Map chart-local SVG coords → viewport for a fixed tip. */
export function clientPointFromChart(
  wrap: HTMLElement | null,
  coordinate: { x?: number; y?: number } | null | undefined,
  fallback?: { clientX: number; clientY: number } | null,
): { x: number; y: number } | null {
  if (fallback && Number.isFinite(fallback.clientX) && Number.isFinite(fallback.clientY)) {
    return { x: fallback.clientX, y: fallback.clientY };
  }
  if (!wrap || !coordinate) return null;
  const x = Number(coordinate.x);
  const y = Number(coordinate.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rect = wrap.getBoundingClientRect();
  return { x: rect.left + x, y: rect.top + y };
}
