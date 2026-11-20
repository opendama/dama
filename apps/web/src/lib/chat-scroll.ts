/** Telegram-style stick-to-latest for chat/DM scrollports. */

const NEAR_BOTTOM_PX = 96;

/**
 * Prefer the dedicated chat message scroller (`[data-dama-chat-scroll]`), then the
 * rail scrollport. Never fall through to a page/aside that also contains the composer.
 */
export function resolveChatScrollRoot(from: HTMLElement | null | undefined): HTMLElement | null {
  if (!from) return null;
  if (from.hasAttribute("data-dama-chat-scroll")) return from;
  const chat = from.closest("[data-dama-chat-scroll]");
  if (chat instanceof HTMLElement) return chat;
  const nested = from.querySelector("[data-dama-chat-scroll]");
  if (nested instanceof HTMLElement) return nested;
  const marked = from.closest("[data-dama-rail-scroll]");
  if (marked instanceof HTMLElement) return marked;
  return from;
}

export function isChatNearBottom(root: HTMLElement, thresholdPx = NEAR_BOTTOM_PX): boolean {
  const gap = root.scrollHeight - root.scrollTop - root.clientHeight;
  return gap <= thresholdPx;
}

/**
 * Pin the scrollport to the newest message (clamped by the browser).
 * One follow-up rAF covers post-paint height (new bubble / date chip) without a
 * multi-frame scroll fight that flickers the focused composer.
 */
export function scrollChatToBottom(
  root: HTMLElement | null | undefined,
  opts?: { behavior?: ScrollBehavior },
): void {
  if (!root) return;
  const behavior = opts?.behavior ?? "auto";
  const apply = () => {
    if (behavior === "smooth") {
      root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
    } else {
      root.scrollTop = root.scrollHeight;
    }
  };
  apply();
  requestAnimationFrame(apply);
}
