"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keep dialog body/id through Radix exit animation (~200ms). */
export const DIALOG_CLEAR_MS = 200;

export function useDeferredDialogSelection(clearMs = DIALOG_CLEAR_MS) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClear = useCallback(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const openWith = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next) return;
      cancelClear();
      setSelectedId(next);
      setOpen(true);
    },
    [cancelClear],
  );

  const close = useCallback(() => {
    setOpen(false);
    cancelClear();
    clearTimer.current = setTimeout(() => {
      setSelectedId("");
      clearTimer.current = null;
    }, clearMs);
  }, [cancelClear, clearMs]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        cancelClear();
        setOpen(true);
        return;
      }
      close();
    },
    [cancelClear, close],
  );

  useEffect(() => () => cancelClear(), [cancelClear]);

  return { open, selectedId, openWith, close, onOpenChange, setSelectedId };
}

/**
 * Controlled dialog open state keyed by an arbitrary value (object/row).
 * Keeps the value until the close animation finishes.
 */
export function useDeferredDialogValue<T>(clearMs = DIALOG_CLEAR_MS) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<T | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClear = useCallback(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const openWith = useCallback(
    (next: T) => {
      cancelClear();
      setValue(next);
      setOpen(true);
    },
    [cancelClear],
  );

  const close = useCallback(() => {
    setOpen(false);
    cancelClear();
    clearTimer.current = setTimeout(() => {
      setValue(null);
      clearTimer.current = null;
    }, clearMs);
  }, [cancelClear, clearMs]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        cancelClear();
        setOpen(true);
        return;
      }
      close();
    },
    [cancelClear, close],
  );

  useEffect(() => () => cancelClear(), [cancelClear]);

  return { open, value, openWith, close, onOpenChange, setValue };
}

export function releaseBodyPointerEvents() {
  if (typeof document === "undefined") return;
  document.body.style.pointerEvents = "";
}

/**
 * Portaled Radix floating layers (Select / Popover / Menu) rendered outside
 * Dialog/Sheet content. Clicks on these must not dismiss the parent overlay.
 */
export function isRadixSelectPortalTarget(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(
    el.closest(
      [
        "[role='listbox']",
        "[data-radix-select-viewport]",
        "[data-radix-popper-content-wrapper]",
        "[data-slot='popover-content']",
        "[data-radix-popover-content]",
        "[data-radix-menu-content]",
        "[data-radix-dropdown-menu-content]",
        "[data-radix-hover-card-content]",
      ].join(","),
    ),
  );
}

/**
 * Safety net for the Radix dismissable-layer bug that leaves
 * `body { pointer-events: none }` after nested Select/Popover/Dialog teardown.
 */
export function useReleaseStuckBodyPointerEvents() {
  useEffect(() => {
    const clearIfIdle = () => {
      if (typeof document === "undefined") return;
      if (document.body.style.pointerEvents !== "none") return;
      // Only keep the body lock while a visible overlay layer is actually open.
      const candidates = document.querySelectorAll(
        [
          "[data-state='open'][role='listbox']",
          "[data-state='open'][role='dialog']",
          "[data-radix-select-viewport]",
          "[data-slot='popover-content'][data-state='open']",
          "[data-radix-menu-content][data-state='open']",
        ].join(","),
      );
      let active = false;
      for (const node of candidates) {
        const el = node as HTMLElement;
        if (el.closest("[aria-hidden='true']")) continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        active = true;
        break;
      }
      if (!active) releaseBodyPointerEvents();
    };
    const onPointerDown = () => {
      window.setTimeout(clearIfIdle, 0);
      window.setTimeout(clearIfIdle, 50);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("visibilitychange", clearIfIdle);
    const id = window.setInterval(clearIfIdle, 400);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("visibilitychange", clearIfIdle);
      window.clearInterval(id);
    };
  }, []);
}
