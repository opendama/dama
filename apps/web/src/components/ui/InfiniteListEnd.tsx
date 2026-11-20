"use client";

import { cn } from "@/lib/utils";
import type { RefObject } from "react";

type Props = {
  sentinelRef: RefObject<HTMLElement | null>;
  loading: boolean;
  loadingLabel?: string;
  className?: string;
};

/**
 * Stable infinite-list end chrome: sentinel + reserved loading slot.
 * Reserving min-height prevents footer mount/unmount scroll jumps (flicker).
 */
export function InfiniteListEnd({ sentinelRef, loading, loadingLabel, className }: Props) {
  const label = (loadingLabel || "").trim();
  return (
    <>
      <div
        ref={sentinelRef as RefObject<HTMLDivElement | null>}
        className="h-px w-full shrink-0"
        aria-hidden
      />
      <div
        className={cn(
          "flex min-h-8 w-full shrink-0 items-center justify-center px-3 py-2",
          className,
        )}
        aria-hidden={!loading}
        aria-live={loading ? "polite" : undefined}
        aria-busy={loading || undefined}
      >
        {loading && label ? (
          <p className="text-center text-xs text-[var(--dama-muted)]">{label}</p>
        ) : null}
      </div>
    </>
  );
}
