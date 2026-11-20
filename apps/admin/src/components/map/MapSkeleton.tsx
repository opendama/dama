"use client";

import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";

/** Leaflet map loading placeholder (smart-menu MapSkeleton, Dama shimmer tokens). */
export default function MapSkeleton() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)]"
      style={{ minHeight: 460, height: "100%" }}
      aria-hidden
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <ShimmerBlock className="h-14 w-14 rounded-full" />
        <ShimmerBlock className="h-3 w-28" />
      </div>
      <div className="absolute right-5 top-5 flex flex-col gap-2">
        <ShimmerBlock className="h-10 w-10 rounded" />
        <ShimmerBlock className="h-10 w-10 rounded" />
        <ShimmerBlock className="h-10 w-10 rounded" />
      </div>
      <div className="absolute bottom-5 left-5 min-w-[12rem] space-y-2 rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)]/90 p-4">
        <ShimmerBlock className="h-3 w-20" />
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-3 w-24" />
      </div>
    </div>
  );
}
