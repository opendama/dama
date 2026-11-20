"use client";

import { useMaxLg } from "@/hooks/useMaxLg";
import { playRailAsideClass } from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import { useShellChromeStore } from "@/store/shell-chrome";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Forwarded to the aside (e.g. aria-label). */
  "aria-label"?: string;
};

/**
 * Play right-rail shell.
 * max-lg: always owns `[data-dama-rail-scroll]` (tabs + lists + chat/DM scroll together).
 * lg+: column shell; body PlayRailScrollPort owns the scroll attribute.
 * Immersive chat only hides the mobile bottom nav - it must not freeze aside overflow on
 * phone/tablet (that made Friends/DMs/Players lists unscrollable).
 */
export function PlayRailAside({ children, className, "aria-label": ariaLabel }: Props) {
  const maxLg = useMaxLg();
  const immersiveChat = useShellChromeStore((s) => s.immersiveChat);
  return (
    <aside
      className={cn(playRailAsideClass, className)}
      aria-label={ariaLabel}
      data-dama-immersive-chat={immersiveChat ? "" : undefined}
      data-skip-hide-on-scroll=""
      {...(maxLg ? { "data-dama-rail-scroll": "" } : {})}
    >
      {children}
    </aside>
  );
}
