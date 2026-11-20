/**
 * Shared surface + CTA classes for player / live-game hover+tap cards.
 * Sized for mobile + desktop so icon+chrome labels never clip (18rem was too tight).
 */
export const PLAYER_POPOVER_SURFACE =
  "z-[200] w-[min(calc(100vw-1.5rem),22rem)] max-w-[calc(100vw-1.5rem)] border-[var(--dama-border)] bg-[var(--dama-card)] p-4 shadow-xl";

/** Full-width primary CTA inside a player popover (stack layout). */
export const PLAYER_POPOVER_CTA =
  "h-10 w-full min-w-0 justify-center gap-2 px-3 text-xs sm:text-sm";
