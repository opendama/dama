"use client";

import { type RefObject, useEffect, useRef } from "react";

function isLaidOutScrollRoot(root: HTMLElement): boolean {
  return root.clientHeight >= 32;
}

const ROOT_MARGIN_PX = 80;

function isSentinelInRootView(root: HTMLElement, sentinel: HTMLElement, marginPx: number): boolean {
  const rootRect = root.getBoundingClientRect();
  const sentRect = sentinel.getBoundingClientRect();
  return sentRect.top < rootRect.bottom + marginPx && sentRect.bottom > rootRect.top - marginPx;
}

/**
 * Admin list infinite scroll - same rising-edge + settle-continue contract as web.
 * `layoutKey` = list identity only (never item count / isFetchingNextPage).
 */
export function useInfinitePanelScroll(opts: {
  enabled: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  sentinelRef: RefObject<HTMLElement | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  layoutKey: string | number;
}) {
  const {
    enabled,
    scrollRef,
    sentinelRef,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    layoutKey,
  } = opts;

  const inflightRef = useRef(false);
  const wasIntersectingRef = useRef(false);
  const fetchRef = useRef(fetchNextPage);
  fetchRef.current = fetchNextPage;

  useEffect(() => {
    if (isFetchingNextPage) inflightRef.current = true;
    else inflightRef.current = false;
  }, [isFetchingNextPage]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind when panel layoutKey changes
  useEffect(() => {
    wasIntersectingRef.current = false;
  }, [layoutKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind observer when layoutKey changes
  useEffect(() => {
    if (!enabled || !hasNextPage) return;
    const root = scrollRef.current;
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
  }, [enabled, scrollRef, sentinelRef, hasNextPage, layoutKey]);

  // Settle after each page: short-list fill + continue while sentinel stayed in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refill when fetch/layout settles
  useEffect(() => {
    if (!enabled || !hasNextPage || isFetchingNextPage) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !isLaidOutScrollRoot(root)) return;

    let cancelled = false;
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
  }, [enabled, hasNextPage, isFetchingNextPage, layoutKey, scrollRef, sentinelRef]);
}
