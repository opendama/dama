"use client";

import type { ChartFloatTip } from "@/hooks/use-sticky-chart-tip";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

const VIEW_PAD = 10;

type ClampedPos = { left: number; top: number; ready: boolean };

/**
 * Fixed tip that stays fully inside the viewport (industry standard clamp).
 * Prefer above the anchor; flip below if needed. Shift horizontally near edges.
 */
export function ViewportFloatTip({
  x,
  y,
  children,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ClampedPos>({ left: x, top: y, ready: false });
  const [anchor, setAnchor] = useState({ x, y });

  // Reset before paint when the anchor moves so we never flash off-screen.
  if (anchor.x !== x || anchor.y !== y) {
    setAnchor({ x, y });
    setPos({ left: x, top: y, ready: false });
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const clamp = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!(w > 0) || !(h > 0)) return;

      // Prefer centered above the anchor.
      let left = x - w / 2;
      let top = y - 8 - h;

      // Flip below when not enough room above.
      if (top < VIEW_PAD) {
        top = y + 12;
      }

      // Horizontal clamp (right-edge and left-edge safe).
      left = Math.min(Math.max(VIEW_PAD, left), Math.max(VIEW_PAD, vw - VIEW_PAD - w));
      // Vertical clamp as last resort.
      top = Math.min(Math.max(VIEW_PAD, top), Math.max(VIEW_PAD, vh - VIEW_PAD - h));

      setPos((prev) => {
        if (prev.ready && prev.left === left && prev.top === top) return prev;
        return { left, top, ready: true };
      });
    };

    clamp();

    // Remeasure if font/layout settles after first paint.
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            clamp();
          })
        : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [x, y]);

  return (
    <div
      ref={ref}
      className={className || "pointer-events-none fixed z-[100] max-w-[min(92vw,20rem)]"}
      style={{
        left: pos.left,
        top: pos.top,
        // Hide until measured to avoid a one-frame flash off-screen.
        opacity: pos.ready ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

export function ChartFloatTipPortal({ tip }: { tip: ChartFloatTip | null }) {
  if (!tip) return null;
  // key remounts when tip identity changes so layout is remeasured cleanly.
  return (
    <ViewportFloatTip key={tip.key} x={tip.x} y={tip.y}>
      {tip.body}
    </ViewportFloatTip>
  );
}
