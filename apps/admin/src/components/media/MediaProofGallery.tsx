"use client";

import { resolvePublicMediaUrl } from "@/lib/resolve-public-media-url";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export type MediaProofSlide = {
  src: string;
  caption?: string;
};

/**
 * Smart-menu style proof gallery: large contain preview + horizontal mini-thumbs.
 * Single-image KYC/receipt proofs stay one frame; multi-image sets get a thumb strip.
 */
export function MediaProofGallery({
  slides,
  className,
}: {
  slides: MediaProofSlide[];
  className?: string;
}) {
  const items = useMemo(
    () =>
      slides
        .map((s) => ({
          src: resolvePublicMediaUrl(s.src),
          caption: (s.caption || "").trim(),
        }))
        .filter((s) => Boolean(s.src)),
    [slides],
  );
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  if (items.length === 0) return null;
  const active = items[Math.min(index, items.length - 1)];
  if (!active) return null;
  const isBroken = Boolean(broken[active.src]);

  return (
    <div className={cn("space-y-3", className)}>
      {active.caption ? (
        <span className="block text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
          {active.caption}
        </span>
      ) : null}
      {isBroken ? (
        <a
          href={active.src}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[var(--dama-gold)] underline underline-offset-4"
        >
          {active.caption || active.src}
        </a>
      ) : (
        <a
          href={active.src}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-[var(--dama-border)] bg-[var(--dama-input)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={active.src}
            src={active.src}
            alt=""
            referrerPolicy="no-referrer"
            className="max-h-[min(55dvh,28rem)] w-full object-contain"
            onError={() => setBroken((prev) => ({ ...prev, [active.src]: true }))}
          />
        </a>
      )}
      {items.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto overscroll-contain pb-1 [-webkit-overflow-scrolling:touch]">
          {items.map((item, i) => {
            const selected = i === index;
            return (
              <button
                key={`${item.src}-${i}`}
                type="button"
                aria-label={item.caption || undefined}
                aria-pressed={selected}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-[var(--dama-surface)] transition-colors sm:h-16 sm:w-16",
                  selected
                    ? "border-[var(--dama-brand)] ring-2 ring-[var(--dama-brand)]/40"
                    : "border-[var(--dama-border)] hover:border-[var(--dama-muted)]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.src}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
