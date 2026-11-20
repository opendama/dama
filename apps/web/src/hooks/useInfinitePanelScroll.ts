"use client";

import { useMaxLg } from "@/hooks/useMaxLg";
import { type RefObject, useEffect, useRef } from "react";

export type InfiniteScrollRootMode = "rail" | "self";

/** Resolve the real overflow scroller (rail aside on max-lg, else the panel port). */
export function resolveInfiniteScrollRoot(
  el: HTMLElement | null,
  mode: InfiniteScrollRootMode = "rail",
): HTMLElement | null {
  if (!el) return null;
  if (mode === "self") return el;
  const rail = el.closest("[data-dama-rail-scroll]");
  if (rail instanceof HTMLElement) return rail;
  return el;
}

/** Reset scrollTop on the resolved root (max-lg aside ≠ PlayRailScrollPort). */
export function resetInfiniteScrollTop(
  scrollRef: RefObject<HTMLElement | null>,
  mode: InfiniteScrollRootMode = "rail",
) {
  const root = resolveInfiniteScrollRoot(scrollRef.current, mode);
  if (root) root.scrollTop = 0;
}

function isLaidOutScrollRoot(root: HTMLElement): boolean {
  // Hidden / zero-size panels must not short-list-fill (display:none → clientHeight 0
  // looked "empty" and cascaded page fetches).
  return root.clientHeight >= 32;
}

const ROOT_MARGIN_PX = 80;

/** Sentinel still inside the scroll root (including prefetch rootMargin). */
function isSentinelInRootView(root: HTMLElement, sentinel: HTMLElement, marginPx: number): boolean {
  const rootRect = root.getBoundingClientRect();
  const sentRect = sentinel.getBoundingClientRect();
  return sentRect.top < rootRect.bottom + marginPx && sentRect.bottom > rootRect.top - marginPx;
}

/**
 * Infinite scroll for rail / panel lists (notification-bell / smart-menu list pattern).
 *
 * - Rising-edge IntersectionObserver when the user scrolls the sentinel into view.
 * - In-flight latch so delayed `isFetchingNextPage` cannot double-fetch.
 * - After each page settles: short-list fill OR continue while sentinel stays in view
 *   (IO does not re-fire if the sentinel never left the root - classic stuck-at-bottom bug).
 * - `layoutKey` = list identity only (tab / query / open) - NEVER item count.
 */
export function useInfinitePanelScroll(opts: {
  enabled: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  sentinelRef: RefObject<HTMLElement | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  layoutKey: string | number;
  rootMode?: InfiniteScrollRootMode;
}) {
  const {
    enabled,
    scrollRef,
    sentinelRef,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    layoutKey,
    rootMode = "rail",
  } = opts;

  const inflightRef = useRef(false);
  const wasIntersectingRef = useRef(false);
  const fetchRef = useRef(fetchNextPage);
  fetchRef.current = fetchNextPage;
  // Rebind when phone/tablet ↔ desktop breakpoint flips (layout height changes).
  const maxLg = useMaxLg();

  useEffect(() => {
    if (isFetchingNextPage) inflightRef.current = true;
    else inflightRef.current = false;
  }, [isFetchingNextPage]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset intersection latch on layout/breakpoint change
  useEffect(() => {
    wasIntersectingRef.current = false;
  }, [layoutKey, maxLg]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind observer when layout/breakpoint changes
  useEffect(() => {
    if (!enabled || !hasNextPage) return;
    const root = resolveInfiniteScrollRoot(scrollRef.current, rootMode);
    const target = sentinelRef.current;
    if (!root || !target || !isLaidOutScrollRoot(root)) return;

    let cancelled = false;

    const loadMore = () => {
      if (cancelled || inflightRef.current) return;
      inflightRef.current = true;
      fetchRef.current();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && !wasIntersectingRef.current) loadMore();
        wasIntersectingRef.current = hit;
      },
      { root, rootMargin: `${ROOT_MARGIN_PX}px 0px`, threshold: 0 },
    );
    observer.observe(target);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [enabled, scrollRef, sentinelRef, hasNextPage, layoutKey, rootMode, maxLg]);

  // Settle after each page: fill short viewports + continue when sentinel stayed in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refill when fetch/layout/breakpoint settles
  useEffect(() => {
    if (!enabled || !hasNextPage || isFetchingNextPage) return;
    const root = resolveInfiniteScrollRoot(scrollRef.current, rootMode);
    const target = sentinelRef.current;
    if (!root || !target || !isLaidOutScrollRoot(root)) return;

    let cancelled = false;
    // Double rAF: wait for footer/list paint so scrollHeight is stable (anti-flicker).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled || inflightRef.current) return;
        if (!isLaidOutScrollRoot(root)) return;
        const short = root.scrollHeight <= root.clientHeight + 8;
        const inView = isSentinelInRootView(root, target, ROOT_MARGIN_PX);
        wasIntersectingRef.current = inView;
        if (!short && !inView) return;
        inflightRef.current = true;
        fetchRef.current();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [
    enabled,
    hasNextPage,
    isFetchingNextPage,
    layoutKey,
    rootMode,
    scrollRef,
    sentinelRef,
    maxLg,
  ]);
}
