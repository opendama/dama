"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

type Options = {
  enabled?: boolean;
  /** Element living inside the scrollport (sticky bar). */
  rootRef: RefObject<HTMLElement | null>;
  /** Min px delta before direction counts. */
  threshold?: number;
  /** Always show near the top of the scrollport. */
  topRevealPx?: number;
  /** Ignore scroll events this long after a hide/show toggle. */
  lockMs?: number;
  /** Bump after Filters expand/collapse so layout jumps are not read as direction. */
  settleToken?: number;
};

function readYFromEvent(event: Event): number {
  const t = event.target;
  if (t instanceof HTMLElement && t !== document.documentElement && t !== document.body) {
    return t.scrollTop;
  }
  if (t === document || t === document.documentElement || t === document.body) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/** True while a modal dialog is open (Radix portals to body). */
function isAnyDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

/**
 * Scroll targets that must not drive tournament/event filter headroom.
 * Includes dialogs/overlays and the play right-rail (center cards only).
 */
function isIgnoredScrollTarget(target: EventTarget | null): boolean {
  // While a dialog is open, ignore *all* scroll - including overscroll that
  // chains into the page column behind the portal (filters must stay put).
  if (isAnyDialogOpen()) return true;
  if (!(target instanceof Element)) return false;
  if (
    target.closest('[role="dialog"]') ||
    target.closest("[data-radix-dialog-content]") ||
    target.closest("[data-skip-hide-on-scroll]") ||
    // Play rail body / aside scroll must not hide center Filters.
    target.closest("[data-dama-rail-scroll]") ||
    target.closest("[data-dama-rail-main]")
  ) {
    return true;
  }
  // Radix portal: dialog content may not be an ancestor of window scroll target in some trees.
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
  for (const d of dialogs) {
    if (d.contains(target)) return true;
  }
  return false;
}

/**
 * Headroom-style: hide on scroll down, show on scroll up.
 * Uses capture-phase scroll so nested overflow scrollports (home hub column)
 * and document scroll (/tournaments) both drive the bar.
 */
export function useHideOnScrollDown({
  enabled = true,
  rootRef,
  threshold = 12,
  topRevealPx = 40,
  lockMs = 280,
  settleToken = 0,
}: Options): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const lockedUntil = useRef(0);
  const hiddenRef = useRef(false);
  const activeScroller = useRef<EventTarget | null>(null);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  // Filters expand/collapse bumps settleToken - show bar + lock so height jump ≠ scroll-down.
  useEffect(() => {
    void settleToken;
    if (settleToken === 0) return;
    setHidden(false);
    hiddenRef.current = false;
    lockedUntil.current = performance.now() + Math.max(lockMs, 420);
    lastY.current = window.scrollY || document.documentElement.scrollTop || 0;
    activeScroller.current = null;
  }, [settleToken, lockMs]);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      hiddenRef.current = false;
      return;
    }

    let frame = 0;

    const apply = (next: boolean) => {
      if (hiddenRef.current === next) return;
      hiddenRef.current = next;
      setHidden(next);
      lockedUntil.current = performance.now() + lockMs;
    };

    const onScroll = (event: Event) => {
      if (isIgnoredScrollTarget(event.target)) return;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (isIgnoredScrollTarget(event.target)) return;
        if (performance.now() < lockedUntil.current) {
          lastY.current = readYFromEvent(event);
          return;
        }
        // Stick to one scroller per gesture so nested + window don't fight.
        if (activeScroller.current && activeScroller.current !== event.target) {
          const yProbe = readYFromEvent(event);
          if (Math.abs(yProbe - lastY.current) < threshold) return;
        }
        activeScroller.current = event.target;
        const y = readYFromEvent(event);
        const delta = y - lastY.current;
        lastY.current = y;
        if (y <= topRevealPx) {
          apply(false);
          return;
        }
        if (delta > threshold) apply(true);
        else if (delta < -threshold) apply(false);
      });
    };

    const endGesture = () => {
      activeScroller.current = null;
    };

    void rootRef;
    lastY.current = window.scrollY || document.documentElement.scrollTop || 0;
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("touchend", endGesture, { passive: true });
    window.addEventListener("mouseup", endGesture, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("touchend", endGesture);
      window.removeEventListener("mouseup", endGesture);
    };
  }, [enabled, rootRef, threshold, topRevealPx, lockMs]);

  return hidden;
}
