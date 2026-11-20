"use client";

import { cn } from "@/lib/utils";

type Props = {
  lines: string[];
  className?: string;
};

/** Persistent official-pause notice. Lines are DB chrome only. */
export function OfficialPauseBanner({ lines, className }: Props) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-md border border-[var(--dama-border)] bg-[var(--dama-surface)] px-3 py-2 text-sm text-[var(--dama-text)]",
        className,
      )}
    >
      <ul className="space-y-1">
        {clean.map((line) => (
          <li key={line} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
