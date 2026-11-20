"use client";

import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { playerProfileHref } from "@/lib/player-profile-href";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { useEffect, useState } from "react";

export type ChatSenderInfo = {
  id: string;
  username: string;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
  countryCode?: string | null;
  rating?: number;
};

type Props = {
  chrome: PlayRailChromeReady;
  sender: ChatSenderInfo;
  /** Own message - profile link only (no social CTAs to self). */
  self?: boolean;
  signedIn?: boolean;
  isFriend?: boolean;
  requestPendingOutgoing?: boolean;
  onChallenge?: (player: RailPlayer) => void;
  onMessage?: (player: RailPlayer) => void;
  onAddFriend?: (player: RailPlayer) => void;
  onRemoveFriend?: (player: RailPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
  className?: string;
};

function toRail(sender: ChatSenderInfo): RailPlayer {
  return {
    id: sender.id,
    username: sender.username,
    rating: typeof sender.rating === "number" ? sender.rating : 0,
    xp: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    countryCode: sender.countryCode,
    avatarThumbUrl: sender.avatarThumbUrl,
    avatarFullUrl: sender.avatarFullUrl,
  };
}

function useFinePointerHover() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

function openProfileTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

/**
 * Chat bubble face: hover/tap opens the same PlayerHoverCard as the play rail;
 * primary click (fine pointer) opens `/players/{id}` in a new tab.
 */
export function ChatSenderAvatar({
  chrome,
  sender,
  self = false,
  signedIn,
  isFriend,
  requestPendingOutgoing,
  onChallenge,
  onMessage,
  onAddFriend,
  onRemoveFriend,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  className,
}: Props) {
  const href = playerProfileHref(sender.id);
  const player = toRail(sender);
  const finePointer = useFinePointerHover();
  const faceClass = cn(
    "mt-auto inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--dama-border)] outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]",
    className,
  );

  if (!href) {
    return (
      <span className={cn("mt-auto inline-flex h-7 w-7 shrink-0", className)}>
        <DamaUserAvatar
          src={sender.avatarThumbUrl || sender.avatarFullUrl}
          className="h-full w-full rounded-full ring-1 ring-[var(--dama-border)]"
        />
      </span>
    );
  }

  // Own messages / fine pointer: click opens profile in a new tab.
  // Touch peers: tap opens PlayerHoverCard (View profile CTA inside).
  const openOnClick = self || finePointer;
  const face = (
    <button
      type="button"
      className={faceClass}
      aria-label={sender.username}
      onClick={(e) => {
        e.stopPropagation();
        if (openOnClick) openProfileTab(href);
      }}
    >
      <DamaUserAvatar
        src={sender.avatarThumbUrl || sender.avatarFullUrl}
        className="h-full w-full rounded-full"
      />
    </button>
  );

  if (self) return face;

  return (
    <PlayerHoverCard
      chrome={chrome}
      player={player}
      signedIn={signedIn}
      isFriend={isFriend}
      requestPendingOutgoing={requestPendingOutgoing}
      onChallenge={onChallenge}
      onMessage={onMessage}
      onAddFriend={onAddFriend}
      onRemoveFriend={onRemoveFriend}
      challengeBusy={challengeBusy}
      friendBusy={friendBusy}
      addFriendBusy={addFriendBusy}
      removeFriendBusy={removeFriendBusy}
      contentSide="top"
      contentAlign="start"
    >
      {face}
    </PlayerHoverCard>
  );
}
