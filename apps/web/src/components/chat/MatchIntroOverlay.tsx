"use client";

import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export type MatchIntroPlayer = {
  username: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  /** API chrome-resolved host trust label (optional). */
  hostTrustBadge?: string | null;
  /** API host_trust_tier code (optional). */
  hostTrustTier?: string | null;
};

type Props = {
  vsLabel: string;
  ariaLabel: string;
  /** Optional esports eyebrow (e.g. "Game starting"). */
  startingLabel?: string;
  durationMs: number;
  /**
   * When true, stay mounted until `active` becomes false (pause cover).
   * Ignores duration auto-dismiss; durationMs may be 0.
   */
  persistent?: boolean;
  top: MatchIntroPlayer;
  bottom: MatchIntroPlayer;
  nameMaxChars?: string;
  nameSuffix?: string;
  active: boolean;
  onDone?: () => void;
  onShow?: () => void;
};

function Seat({
  player,
  nameMaxChars,
  nameSuffix,
  align,
}: {
  player: MatchIntroPlayer;
  nameMaxChars?: string;
  nameSuffix?: string;
  align: "top" | "bottom";
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2.5",
        align === "top"
          ? "animate-in fade-in slide-in-from-top-6 duration-700"
          : "animate-in fade-in slide-in-from-bottom-6 duration-700",
      )}
    >
      <span
        className="pointer-events-none absolute -inset-4 rounded-full opacity-70 blur-xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--dama-brand) 55%, transparent), transparent 70%)",
        }}
        aria-hidden
      />
      <DamaUserAvatar
        src={player.avatarUrl}
        className="relative h-20 w-20 rounded-xl border-2 border-[var(--dama-brand)] shadow-[0_0_28px_color-mix(in_srgb,var(--dama-brand)_45%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--dama-brand)_30%,transparent)] sm:h-24 sm:w-24"
      />
      <p className="relative flex items-center gap-2 text-lg font-bold tracking-tight text-white dark:text-[var(--dama-text)] sm:text-xl">
        <CountryFlag code={player.countryCode} className="h-4 w-6" />
        {formatPlayerNameDisplay(player.username, nameMaxChars ?? "", nameSuffix ?? "")}
      </p>
      <HostTrustBadge
        label={player.hostTrustBadge}
        tier={player.hostTrustTier}
        onMedia
        className="relative text-[9px]"
      />
    </div>
  );
}

/** Full-board esports VS intro: top vs bottom, then dismisses. */
export function MatchIntroOverlay({
  vsLabel,
  ariaLabel,
  startingLabel,
  durationMs,
  persistent = false,
  top,
  bottom,
  nameMaxChars,
  nameSuffix,
  active,
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
    if (persistent) {
      setVisible(true);
      onShowRef.current?.();
      return;
    }
    // Fail closed: duration must come from DB chrome (no invented default).
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
  }, [active, durationMs, persistent]);

  if (!visible) return null;

  const starting = (startingLabel || "").trim();

  return (
    <output
      className="pointer-events-auto absolute inset-0 z-40 flex h-full min-h-full w-full min-w-full flex-col items-center justify-center overflow-hidden bg-[var(--dama-bg)]/90 backdrop-blur-md"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 45%, color-mix(in srgb, var(--dama-brand) 35%, transparent), transparent 70%)",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--dama-brand) 80%, white), transparent)",
          boxShadow: "0 0 18px color-mix(in srgb, var(--dama-brand) 70%, transparent)",
        }}
        aria-hidden
      />

      {starting ? (
        <p className="relative mb-5 animate-in fade-in zoom-in-95 duration-500 text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--dama-brand)] dark:text-[var(--dama-text)] sm:text-xs">
          <span className="inline-block animate-pulse drop-shadow-[0_0_12px_color-mix(in_srgb,var(--dama-brand)_80%,transparent)] dark:drop-shadow-[0_0_12px_color-mix(in_srgb,var(--dama-text)_45%,transparent)]">
            {starting}
          </span>
        </p>
      ) : null}

      <Seat player={top} nameMaxChars={nameMaxChars} nameSuffix={nameSuffix} align="top" />

      <div className="relative my-3 flex items-center justify-center sm:my-4">
        <span
          className="absolute h-16 w-16 animate-ping rounded-full bg-[var(--dama-brand)]/25 sm:h-20 sm:w-20"
          aria-hidden
        />
        <span
          className="absolute h-12 w-12 rounded-full bg-[var(--dama-brand)]/20 blur-md sm:h-14 sm:w-14"
          aria-hidden
        />
        <p
          className="relative text-3xl font-black uppercase tracking-[0.28em] text-[var(--dama-brand)] drop-shadow-[0_0_18px_color-mix(in_srgb,var(--dama-brand)_70%,transparent)] sm:text-4xl"
          style={{
            // Theme token (not hard white) so dark/light pause+intro covers stay readable.
            WebkitTextStroke: "5px var(--dama-card)",
            paintOrder: "stroke fill",
          }}
        >
          {vsLabel}
        </p>
      </div>

      <Seat player={bottom} nameMaxChars={nameMaxChars} nameSuffix={nameSuffix} align="bottom" />
    </output>
  );
}
