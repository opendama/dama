"use client";

import { useEffect, useRef } from "react";

type Opts = {
  /** Scroll root (rail port or list). */
  root: HTMLElement | null;
  /** Re-bind when message set changes. */
  messageKey: string;
  enabled: boolean;
  onMarkRead: (messageId: string) => void;
};

/**
 * Telegram-style progressive read: mark the farthest-in-time message that
 * intersects the scroll viewport (threshold ~40%). Debounced to avoid spam.
 */
export function useChatVisibleMarkRead({ root, messageKey, enabled, onMarkRead }: Opts) {
  const onMarkRef = useRef(onMarkRead);
  onMarkRef.current = onMarkRead;
  const lastSentRef = useRef("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind observers when message set changes
  useEffect(() => {
    if (!enabled || !root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-chat-msg-id]");
    if (nodes.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const visible = new Map<string, number>();

    const flush = () => {
      let bestId = "";
      let bestAt = -1;
      for (const [id, at] of visible) {
        if (at >= bestAt) {
          bestAt = at;
          bestId = id;
        }
      }
      if (!bestId || bestId === lastSentRef.current) return;
      lastSentRef.current = bestId;
      onMarkRef.current(bestId);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 180);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const id = (el.getAttribute("data-chat-msg-id") || "").trim();
          if (!id) continue;
          const at = Number(el.getAttribute("data-chat-msg-at") || 0);
          if (e.isIntersecting && e.intersectionRatio >= 0.35) {
            visible.set(id, Number.isFinite(at) ? at : 0);
          } else {
            visible.delete(id);
          }
        }
        schedule();
      },
      { root, threshold: [0.35, 0.5, 0.75] },
    );

    for (const n of nodes) {
      io.observe(n);
    }
    // Initial pass after layout (bottom-visible messages).
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [root, messageKey, enabled]);
}
