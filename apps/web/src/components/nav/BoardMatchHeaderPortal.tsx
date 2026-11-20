"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Marker attribute for the global page-header match seats slot. */
export const BOARD_MATCH_HEADER_SLOT = "data-board-match-header";

/**
 * Renders live match seat chrome into the sticky page header (outside the board column).
 * Active only while a board surface wants the seats visible.
 */
export function BoardMatchHeaderPortal({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    const find = () => document.querySelector(`[${BOARD_MATCH_HEADER_SLOT}]`);
    setSlot(find());
    const obs = new MutationObserver(() => setSlot(find()));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!slot) return;
    if (active) slot.setAttribute("data-active", "");
    else slot.removeAttribute("data-active");
    return () => {
      slot.removeAttribute("data-active");
    };
  }, [slot, active]);

  if (!active || !slot) return null;
  return createPortal(children, slot);
}
