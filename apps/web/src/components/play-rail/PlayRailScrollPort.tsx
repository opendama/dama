"use client";

import { useMaxLg } from "@/hooks/useMaxLg";
import {
  playRailAsideScrollClass,
  playRailChatContainScrollClass,
  playRailChatMessageScrollClass,
} from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import { type ReactNode, forwardRef } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /**
   * `messages` - this node scrolls the thread (composer must be a sibling outside).
   * `contain` - flex fill only; child (e.g. GameChatPanel) owns the message scroller.
   * `auto` - default list/rail body behavior.
   */
  chat?: "auto" | "messages" | "contain";
};

/**
 * Panel body region.
 * lg+: overflow-y scrollport under frozen rail chrome (`[data-dama-rail-scroll]`).
 * max-lg: content wrapper only - PlayRailAside is always the scrollport (lists + chat/DM).
 * Desktop chat: pass `chat="messages"` or `chat="contain"` for nested message scrolling.
 */
export const PlayRailScrollPort = forwardRef<HTMLDivElement, Props>(function PlayRailScrollPort(
  { children, className, chat = "auto" },
  ref,
) {
  const maxLg = useMaxLg();

  if (chat === "contain") {
    return (
      <div ref={ref} className={cn(playRailChatContainScrollClass, className)}>
        {children}
      </div>
    );
  }

  if (chat === "messages") {
    return (
      <div
        ref={ref}
        className={cn(playRailChatMessageScrollClass, className)}
        data-dama-rail-scroll=""
        data-dama-chat-scroll=""
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(playRailAsideScrollClass, className)}
      {...(maxLg ? {} : { "data-dama-rail-scroll": "" })}
    >
      {children}
    </div>
  );
});
