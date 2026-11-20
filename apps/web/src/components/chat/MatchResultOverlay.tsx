"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export type MatchResultTone = "win" | "loss" | "draw";

type Props = {
  active: boolean;
  tone: MatchResultTone;
  title: string;
  message: string;
  ariaLabel: string;
  durationMs: number;
  onDone?: () => void;
  onShow?: () => void;
};

/** Full-board cinematic result: win celebration / loss / draw, then dismisses. */
export function MatchResultOverlay({
  active,
  tone,
  title,
  message,
  ariaLabel,
  durationMs,
  onDone,
  onShow,
}: Props) {
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  const onShowRef = useRef(onShow);
  onDoneRef.current = onDone;
  onShowRef.current = onShow;

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      setVisible(false);
      onDoneRef.current?.();
      return;
    }
    setVisible(true);
    onShowRef.current?.();
    const tDone = window.setTimeout(() => {
      setVisible(false);
      onDoneRef.current?.();
    }, durationMs);
    return () => window.clearTimeout(tDone);
  }, [active, durationMs]);

  if (!visible) return null;

  const win = tone === "win";
  const loss = tone === "loss";

  return (
    <output
      className={cn(
        // No backdrop-blur - that caused the top/edge seam glitch on dismiss.
        "pointer-events-auto absolute inset-0 z-50 flex h-full min-h-full w-full min-w-full flex-col items-center justify-center overflow-hidden",
        win && "bg-[var(--dama-bg)]/88",
        loss && "bg-black/80",
        tone === "draw" && "bg-[var(--dama-bg)]/90",
      )}
      aria-label={ariaLabel || message || title}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: win
            ? "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in srgb, var(--dama-brand) 45%, transparent), transparent 72%)"
            : loss
              ? "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(80,16,24,0.55), transparent 72%)"
              : "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in srgb, var(--dama-muted) 25%, transparent), transparent 72%)",
        }}
        aria-hidden
      />

      {win ? (
        <span
          className="pointer-events-none absolute h-40 w-40 animate-ping rounded-full bg-[var(--dama-brand)]/20"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative flex max-w-[90%] flex-col items-center gap-2 rounded-2xl border px-8 py-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-500",
          win &&
            "border-[var(--dama-brand)] bg-[var(--dama-panel)]/90 shadow-[0_0_40px_color-mix(in_srgb,var(--dama-brand)_40%,transparent)]",
          loss && "border-red-900/60 bg-zinc-950/90 shadow-[0_0_36px_rgba(80,0,0,0.45)]",
          tone === "draw" && "border-[var(--dama-border)] bg-[var(--dama-panel)]/90",
        )}
      >
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.3em]",
            win && "text-[var(--dama-brand)]",
            loss && "text-red-300/80",
            tone === "draw" && "text-[var(--dama-muted)]",
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "font-display text-3xl font-black tracking-tight sm:text-4xl",
            win &&
              "text-[var(--dama-text)] drop-shadow-[0_0_16px_color-mix(in_srgb,var(--dama-brand)_55%,transparent)]",
            loss && "text-red-100",
            tone === "draw" && "text-[var(--dama-text)]",
          )}
        >
          {message}
        </p>
      </div>
    </output>
  );
}
