"use client";

import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { CountryFlag } from "@/lib/country-flag";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  /** Turn / status (unused beside name; active seat is the white clock). */
  hint?: string;
  /** Rating shown as (rating) after the name when paren chrome is ready. */
  rating?: number | null;
  ratingParenOpen?: string | null;
  ratingParenClose?: string | null;
  clock?: ReactNode;
  /** Active seat clock (Chess.com white timer) vs idle dark timer. */
  clockActive?: boolean;
  tone?: "muted" | "strong";
  captures?: number;
  pieceSide?: "light" | "dark";
  online?: boolean;
  playing?: boolean;
  avatarThumbUrl?: string | null;
  countryCode?: string | null;
  /** e.g. 2D/3D toggle - left of the clock, still inside board width. */
  trailing?: ReactNode;
  className?: string;
  /** When set with railChrome, avatar+name open PlayerHoverCard (clock/trailing stay cold). */
  hoverPlayer?: RailPlayer | null;
  railChrome?: PlayRailChromeReady | null;
  signedIn?: boolean;
};

/**
 * Chess.com-style seat bar: flush board width.
 * Left: square avatar · name · (rating) · flag
 * Right: optional trailing · timer box (flush to board edge)
 */
export function BoardSeatBar({
  label,
  hint,
  rating,
  ratingParenOpen,
  ratingParenClose,
  clock,
  clockActive = false,
  tone: _tone = "muted",
  captures,
  pieceSide = "light",
  online,
  playing,
  avatarThumbUrl,
  countryCode,
  trailing,
  className,
  hoverPlayer,
  railChrome,
  signedIn,
}: Props) {
  const clockText = typeof clock === "string" ? clock.trim() : "";
  const showPresence = online != null || playing != null;
  const thumb = (avatarThumbUrl || "").trim();
  const activeClock = clockActive;
  const open = (ratingParenOpen || "").trim();
  const close = (ratingParenClose || "").trim();
  const ratingN = typeof rating === "number" && Number.isFinite(rating) ? Math.floor(rating) : null;
  const ratingText = ratingN != null && open && close ? `${open}${ratingN}${close}` : "";
  const a11y = [label, ratingText, (hint || "").trim()].filter(Boolean).join(" ");

  const clockBoxClass = cn(
    // Fixed min-width + always-reserved icon slot so turn flips don't shift the timer.
    "inline-flex min-w-[4.25rem] items-center justify-center gap-1 rounded-sm px-2 py-1.5 font-mono text-sm font-bold tabular-nums leading-none sm:min-w-[5.5rem] sm:gap-1.5 sm:px-3 sm:text-[15px] lg:min-w-[6rem] lg:text-lg",
    activeClock ? "bg-white text-black" : "bg-[var(--dama-panel)] text-[var(--dama-muted)]",
  );

  const clockNode =
    clockText || clock ? (
      <span className={clockBoxClass}>
        <Clock
          className={cn("h-3.5 w-3.5 shrink-0", activeClock ? "opacity-80" : "opacity-0")}
          aria-hidden
        />
        {clockText ? (
          <span className="min-w-[2.75ch] text-center tabular-nums">{clockText}</span>
        ) : (
          clock
        )}
      </span>
    ) : null;

  const avatarFace = (
    <span
      className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-visible rounded-sm text-xs font-semibold ring-1 ring-black/30 sm:h-9 sm:w-9 sm:text-sm"
      style={
        thumb
          ? undefined
          : {
              // Seat swatch = that seat's piece color (not inverted contrast).
              background:
                pieceSide === "light" ? "var(--dama-piece-light)" : "var(--dama-piece-dark)",
              color: pieceSide === "light" ? "var(--dama-piece-dark)" : "var(--dama-piece-light)",
            }
      }
      aria-hidden
    >
      <DamaUserAvatar
        src={avatarThumbUrl}
        pieceSide={pieceSide}
        showMarkPlate={Boolean(thumb)}
        className="absolute inset-0 h-full w-full rounded-sm"
      />
      {showPresence ? (
        <OnlineStatusDot
          online={online}
          playing={playing}
          className="shadow-[0_0_0_2px_var(--dama-bg)]"
        />
      ) : null}
    </span>
  );

  const nameBlock = (
    <span className="min-w-0">
      <span className="block min-w-0 truncate text-sm font-bold text-[var(--dama-text)] hover:underline">
        {label}
      </span>
      <HostTrustBadge
        label={hoverPlayer?.hostTrustBadge}
        tier={hoverPlayer?.hostTrustTier}
        className="mt-0.5 text-[9px]"
      />
    </span>
  );

  const canHover = Boolean(railChrome && hoverPlayer?.id && (hoverPlayer.username || "").trim());
  const identity =
    canHover && railChrome && hoverPlayer ? (
      <PlayerHoverCard
        chrome={railChrome}
        player={hoverPlayer}
        signedIn={signedIn}
        contentSide="bottom"
        contentAlign="start"
      >
        <button
          type="button"
          className="inline-flex min-w-0 max-w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]"
          aria-label={label}
        >
          {avatarFace}
          {nameBlock}
        </button>
      </PlayerHoverCard>
    ) : (
      <>
        {avatarFace}
        {nameBlock}
      </>
    );

  return (
    <div
      className={cn("flex w-full min-w-0 items-center gap-2 overflow-hidden", className)}
      title={a11y}
      aria-label={canHover ? undefined : a11y}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {identity}
        {ratingText ? (
          <span className="shrink-0 text-[12px] font-normal text-[var(--dama-muted)]">
            {ratingText}
          </span>
        ) : null}
        <CountryFlag code={countryCode} />
        {typeof captures === "number" ? (
          <span className="shrink-0 rounded-sm bg-[var(--dama-panel)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--dama-muted)]">
            {captures}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {clockNode}
      </div>
    </div>
  );
}
