"use client";

import { OnlineStatusDot, presenceStatusLabel } from "@/components/play-rail/OnlineStatusDot";
import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { playerProfileHref } from "@/lib/player-profile-href";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import type { PublicPlayerCard } from "@/types/player";
import type { ReactElement } from "react";

export type RailPlayer = PublicPlayerCard & {
  playing?: boolean;
  playingGameId?: string | null;
};

type Props = {
  chrome: PlayRailChromeReady;
  player: RailPlayer;
  onChallenge?: (player: RailPlayer) => void;
  onWatch?: (gameId: string) => void;
  onMessage?: (player: RailPlayer) => void;
  onAddFriend?: (player: RailPlayer) => void;
  onRemoveFriend?: (player: RailPlayer) => void;
  /** Primary activate (profile / inspect) on name click - one press after search debounce. */
  onActivate?: (player: RailPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
  requestPendingOutgoing?: boolean;
  signedIn?: boolean;
  /** Undefined when membership unknown (friends fetch failed) - hide Add/Remove. */
  isFriend?: boolean;
};

export function PlayerListRow({
  chrome,
  player,
  onChallenge,
  onWatch,
  onMessage,
  onAddFriend,
  onRemoveFriend,
  onActivate,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  requestPendingOutgoing,
  signedIn,
  isFriend,
}: Props) {
  const status = presenceStatusLabel(player.online, player.playing, {
    online: chrome.online_label,
    playing: chrome.playing_label,
    offline: chrome.offline_label,
  });
  const profileHref = playerProfileHref(player.id);
  const viewLabel = (chrome.view_profile_action || "").trim();
  const displayName = formatPlayerNameDisplay(
    player.username,
    chrome.live_player_name_max_chars,
    chrome.name_truncate_suffix,
  );

  const wrapHover = (child: ReactElement) => (
    <PlayerHoverCard
      chrome={chrome}
      player={player}
      onChallenge={onChallenge}
      onWatch={onWatch}
      onMessage={onMessage}
      onAddFriend={onAddFriend}
      onRemoveFriend={onRemoveFriend}
      challengeBusy={challengeBusy}
      friendBusy={friendBusy}
      addFriendBusy={addFriendBusy}
      removeFriendBusy={removeFriendBusy}
      requestPendingOutgoing={requestPendingOutgoing}
      signedIn={signedIn}
      isFriend={isFriend}
      // When name click opens profile, do not steal the first tap with a touch Popover.
      openOnClick={!onActivate}
    >
      {child}
    </PlayerHoverCard>
  );

  const avatarFace = (
    <>
      <DamaUserAvatar
        src={player.avatarThumbUrl || player.avatarFullUrl}
        className="absolute inset-0 h-full w-full rounded-md"
      />
      <OnlineStatusDot online={player.online} playing={player.playing} />
    </>
  );

  return (
    <div className="flex w-full items-center gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5 transition-colors hover:bg-[var(--dama-hover)]">
      {/* One HoverCard for avatar+name (gap-safe). Rating/status/View stay outside. */}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {wrapHover(
            <button
              type="button"
              className="inline-flex min-w-0 max-w-full items-center gap-2 text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]"
              aria-label={player.username}
              // Search field stays focused after debounce; without this the first
              // press only blurs the input and a second press opens the card.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onActivate?.(player)}
            >
              <span className="relative h-8 w-8 shrink-0 overflow-visible rounded-md bg-[var(--dama-surface)] hover:opacity-90">
                {avatarFace}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--dama-text)] hover:underline">
                {displayName}
              </span>
            </button>,
          )}
          <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
            {chrome.rating_paren_open}
            {player.rating}
            {chrome.rating_paren_close}
          </span>
          <CountryFlag
            code={player.countryCode}
            imageUrlTemplate={chrome.country_flag_image_url_template}
          />
        </span>
        {(player.hostTrustBadge || "").trim() ? (
          <HostTrustBadge
            label={player.hostTrustBadge}
            tier={player.hostTrustTier}
            className="mt-0.5 text-[9px]"
          />
        ) : null}
        {requestPendingOutgoing ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
            {chrome.friend_request_outgoing_label}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          player.playing
            ? "text-[var(--dama-playing)]"
            : player.online
              ? "text-[var(--dama-online)]"
              : "text-[var(--dama-offline)]",
        )}
      >
        {status}
      </span>
      {viewLabel && profileHref ? (
        <a
          href={profileHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded border border-[var(--dama-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)] transition-colors hover:border-[var(--dama-text)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]"
          onClick={(e) => e.stopPropagation()}
        >
          {viewLabel}
        </a>
      ) : null}
    </div>
  );
}
