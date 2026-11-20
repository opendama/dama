"use client";

import { cn } from "@/lib/utils";

/**
 * Chess.com presence: green online / red playing / muted offline.
 * Inset + box-shadow (not ring) so the badge stays visible inside
 * `overflow-hidden` avatar wells used across lists and seats.
 */
export function OnlineStatusDot({
  online,
  playing,
  className,
  size = "sm",
}: {
  online?: boolean;
  playing?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const tone = playing
    ? "bg-[var(--dama-playing)]"
    : online
      ? "bg-[var(--dama-online)]"
      : "bg-[var(--dama-offline)]";
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-0.5 right-0.5 z-[1] rounded-full",
        // Match card/list surfaces (panel ring looked wrong on --dama-card hover bodies).
        "shadow-[0_0_0_2px_var(--dama-card)]",
        size === "md" ? "h-3 w-3" : "h-2.5 w-2.5",
        tone,
        className,
      )}
      aria-hidden
    />
  );
}

export function presenceStatusLabel(
  online: boolean | undefined,
  playing: boolean | undefined,
  labels: { online: string; playing: string; offline: string },
): string {
  if (playing) return labels.playing;
  if (online) return labels.online;
  return labels.offline;
}
