import type { CSSProperties } from "react";

/** DB-driven dialog shell metrics for hosted events (fail closed when incomplete). */

export type EventsDialogShellChrome = {
  dialog_shell_max_height_ratio?: string;
  dialog_shell_max_width?: string;
  dialog_shell_loading_height?: string;
  wide_dialog_max_width?: string;
};

export function eventsDialogShellStyle(
  chrome: EventsDialogShellChrome,
  opts?: { wide?: boolean },
): { maxWidth: number; maxHeight: string } | null {
  const widthRaw = opts?.wide ? chrome.wide_dialog_max_width : chrome.dialog_shell_max_width;
  const w = Number((widthRaw || "").trim());
  const ratio = Number((chrome.dialog_shell_max_height_ratio || "").trim());
  if (!Number.isFinite(w) || w <= 0) return null;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) return null;
  return { maxWidth: w, maxHeight: `${ratio * 100}dvh` };
}

/**
 * Fixed shell box for tabbed manage dialogs.
 * maxHeight alone lets short tabs shrink the centered modal (flicker on tab change).
 */
export function eventsDialogShellLockedStyle(
  chrome: EventsDialogShellChrome,
  opts?: { wide?: boolean },
): CSSProperties | null {
  const base = eventsDialogShellStyle(chrome, opts);
  if (!base) return null;
  return {
    maxWidth: base.maxWidth,
    width: "100%",
    height: base.maxHeight,
    maxHeight: base.maxHeight,
  };
}

export function eventsLoadingBlockHeight(chrome: EventsDialogShellChrome): number | null {
  const h = Number((chrome.dialog_shell_loading_height || "").trim());
  if (!Number.isFinite(h) || h <= 0) return null;
  return h;
}
