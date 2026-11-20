"use client";

import { cn } from "@/lib/utils";

/**
 * Thin indeterminate fetch bar (Trim parity).
 * Absolutely positioned so mount/unmount never shifts layout or forces
 * Recharts ResponsiveContainer to resize (the Status period-filter glitch).
 * Parent must be `position: relative`.
 */
export function FetchProgressBar({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden",
        className,
      )}
      aria-hidden={!active}
    >
      {active ? (
        <output
          className="relative block h-full w-full bg-[var(--dama-border)]"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="absolute inset-y-0 w-1/3 animate-fetch-bar rounded-full bg-[var(--dama-text)]" />
        </output>
      ) : null}
    </div>
  );
}
