"use client";

import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePublicPlayerQuery } from "@/hooks/query/usePublicPlayerQuery";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay } from "@/lib/play-rail-display";
import { PLAYER_POPOVER_CTA, PLAYER_POPOVER_SURFACE } from "@/lib/player-card-popover";
import { playerProfileHref } from "@/lib/player-profile-href";
import { mergeRailPlayerFromPublic } from "@/lib/rail-player-from-public";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Eye, Mail, Swords, User, UserMinus, UserPlus } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

export type FriendRequestCardActions = {
  side: "in" | "out";
  status: string;
  requestBusy?: boolean;
  acceptBusy?: boolean;
  denyBusy?: boolean;
  cancelBusy?: boolean;
  onAccept?: () => void;
  onDeny?: () => void;
  onCancel?: () => void;
};

type Props = {
  chrome: PlayRailChromeReady;
  player: RailPlayer;
  /** Row control - must be a single element that can take a ref (e.g. `<button>`). */
  children: ReactElement;
  onChallenge?: (player: RailPlayer) => void;
  onWatch?: (gameId: string) => void;
  onAddFriend?: (player: RailPlayer) => void;
  onRemoveFriend?: (player: RailPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
  signedIn?: boolean;
  /** When true, friend button removes instead of adds. */
  isFriend?: boolean;
  /** Outgoing pending request: hide Add, show status in card. */
  requestPendingOutgoing?: boolean;
  /** Incoming/outgoing request CTAs inside the profile card. */
  requestActions?: FriendRequestCardActions;
  /** Opens compose-DM modal for this player. */
  onMessage?: (player: RailPlayer) => void;
  /**
   * Prefer for left-rail seat stacks: `"right"` opens into the row so the card
   * avatar stays top-left (All Players parity). Default follows rail width.
   */
  contentSide?: "top" | "right" | "bottom" | "left";
  contentAlign?: "start" | "center" | "end";
  /**
   * When false (conversation lists): fine-pointer still peeks on hover, but
   * coarse/touch does not steal the primary row click with a Popover. Default true.
   */
  openOnClick?: boolean;
};

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

function useNarrowRail() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function PlayerCardBody({
  chrome,
  player,
  presenceReady,
  onChallenge,
  onWatch,
  onAddFriend,
  onRemoveFriend,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  signedIn,
  isFriend,
  requestPendingOutgoing,
  requestActions,
  onMessage,
  onAction,
}: Omit<Props, "children"> & { presenceReady?: boolean; onAction?: () => void }) {
  const canWatch = Boolean(player.playing && player.playingGameId && onWatch);
  const showFriendToggle =
    !requestActions && (onAddFriend || onRemoveFriend) && !requestPendingOutgoing;
  const req = requestActions;
  const showMessage = Boolean(signedIn && onMessage);
  const profileHref = playerProfileHref(player.id);
  const viewLabel = (chrome.view_profile_action || "").trim();
  const showPresence = presenceReady !== false;

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="relative h-14 w-14 shrink-0 overflow-visible rounded-md">
          <DamaUserAvatar
            src={player.avatarFullUrl || player.avatarThumbUrl}
            className="h-14 w-14 rounded-md"
          />
          {showPresence ? (
            <OnlineStatusDot online={player.online} playing={player.playing} size="md" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-[var(--dama-text)]">
              {formatPlayerNameDisplay(
                player.username,
                chrome.live_player_name_max_chars,
                chrome.name_truncate_suffix,
              )}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
              {chrome.rating_paren_open}
              {player.rating}
              {chrome.rating_paren_close}
            </span>
            <CountryFlag
              code={player.countryCode}
              imageUrlTemplate={chrome.country_flag_image_url_template}
            />
          </p>
          {player.levelLabel ? (
            <p className="mt-0.5 text-xs text-[var(--dama-muted)]">{player.levelLabel}</p>
          ) : null}
          {(player.hostTrustBadge || "").trim() ? (
            <HostTrustBadge
              label={player.hostTrustBadge}
              tier={player.hostTrustTier}
              className="mt-1 text-[10px]"
            />
          ) : null}
          {Number.isFinite(player.wins) &&
          Number.isFinite(player.losses) &&
          typeof player.draws === "number" ? (
            <p className="mt-1 text-xs tabular-nums text-[var(--dama-muted)]">
              {player.wins + player.losses + player.draws}
              {chrome.games_played_abbr}
              {chrome.stats_separator}
              {player.wins}
              {chrome.wins_abbr}
              {chrome.stats_separator}
              {player.losses}
              {chrome.losses_abbr}
              {chrome.stats_separator}
              {player.draws}
              {chrome.draws_abbr}
            </p>
          ) : null}
          {requestPendingOutgoing || (req && req.status === "pending" && req.side === "out") ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.friend_request_outgoing_label}
            </p>
          ) : null}
          {req && req.status === "pending" && req.side === "in" ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.friend_request_pending_label}
            </p>
          ) : null}
          {req && req.status === "denied" ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.friend_request_denied_label}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {/* Stacked full-width CTAs: chrome labels never clip on mobile or desktop. */}
        {viewLabel && profileHref ? (
          <Button variant="outline" className={cn(PLAYER_POPOVER_CTA)} asChild>
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onAction?.()}
            >
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{viewLabel}</span>
            </a>
          </Button>
        ) : null}
        {canWatch ? (
          <Button
            type="button"
            variant="outline"
            className={cn(PLAYER_POPOVER_CTA)}
            onClick={() => {
              if (player.playingGameId) onWatch?.(player.playingGameId);
              onAction?.();
            }}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{chrome.watch_game_action}</span>
          </Button>
        ) : null}
        {!req && showFriendToggle ? (
          <Button
            type="button"
            variant="outline"
            className={cn(PLAYER_POPOVER_CTA)}
            aria-label={isFriend ? chrome.remove_friend_action : chrome.send_friend_request_action}
            disabled={!signedIn || friendBusy}
            isLoading={Boolean(isFriend ? removeFriendBusy : addFriendBusy)}
            pendingLabel={isFriend ? chrome.removing_friend : chrome.sending_friend_request}
            onClick={() => {
              if (isFriend) onRemoveFriend?.(player);
              else onAddFriend?.(player);
              onAction?.();
            }}
          >
            {isFriend ? (
              <UserMinus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 truncate">
              {isFriend ? chrome.remove_friend_action : chrome.send_friend_request_action}
            </span>
          </Button>
        ) : null}
        {showMessage ? (
          <Button
            type="button"
            variant="outline"
            className={cn(PLAYER_POPOVER_CTA)}
            onClick={() => {
              onMessage?.(player);
              onAction?.();
            }}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{chrome.message_action}</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="play"
          className={cn(PLAYER_POPOVER_CTA)}
          disabled={!signedIn || challengeBusy || !onChallenge}
          isLoading={Boolean(challengeBusy)}
          pendingLabel={chrome.sending_challenge}
          onClick={() => {
            onChallenge?.(player);
            onAction?.();
          }}
        >
          <Swords className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{chrome.challenge_action}</span>
        </Button>
        {req && req.side === "in" && req.status === "pending" ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Button
              type="button"
              variant="play"
              className={cn(PLAYER_POPOVER_CTA)}
              isLoading={Boolean(req.acceptBusy)}
              pendingLabel={chrome.accepting_friend_request}
              disabled={req.requestBusy}
              onClick={() => {
                req.onAccept?.();
                onAction?.();
              }}
            >
              <span className="min-w-0 truncate">{chrome.accept_friend_request_action}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(PLAYER_POPOVER_CTA)}
              isLoading={Boolean(req.denyBusy)}
              pendingLabel={chrome.denying_friend_request}
              disabled={req.requestBusy}
              onClick={() => {
                req.onDeny?.();
                onAction?.();
              }}
            >
              <span className="min-w-0 truncate">{chrome.deny_friend_request_action}</span>
            </Button>
          </div>
        ) : null}
        {req && req.side === "out" && req.status === "pending" ? (
          <Button
            type="button"
            variant="outline"
            className={cn(PLAYER_POPOVER_CTA)}
            isLoading={Boolean(req.cancelBusy)}
            pendingLabel={chrome.cancelling_friend_request}
            disabled={req.requestBusy}
            onClick={() => {
              req.onCancel?.();
              onAction?.();
            }}
          >
            <span className="min-w-0 truncate">{chrome.cancel_friend_request_action}</span>
          </Button>
        ) : null}
      </div>
    </>
  );
}

/** Chess.com-style profile card: shadcn HoverCard on fine pointers; Popover tap on touch. */
export function PlayerHoverCard({
  chrome,
  player,
  children,
  onChallenge,
  onWatch,
  onAddFriend,
  onRemoveFriend,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  signedIn,
  isFriend,
  requestPendingOutgoing,
  requestActions,
  onMessage,
  contentSide,
  contentAlign,
  openOnClick = true,
}: Props) {
  const finePointer = useFinePointerHover();
  const narrow = useNarrowRail();
  const [open, setOpen] = useState(false);
  // Avoid SSR/client branch mismatch: mount children first, then HoverCard vs Popover.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Chat/DM stubs omit presence + W/L; hydrate like PlayerProfileModal / MatchSeatAvatars.
  const liveQuery = usePublicPlayerQuery(player.id, open && Boolean(player.id));
  const displayPlayer = useMemo(
    () => mergeRailPlayerFromPublic(player, liveQuery.data),
    [player, liveQuery.data],
  );
  const presenceReady =
    typeof player.online === "boolean" || liveQuery.isSuccess || liveQuery.isError;

  const body = (
    <PlayerCardBody
      chrome={chrome}
      player={displayPlayer}
      presenceReady={presenceReady}
      onChallenge={onChallenge}
      onWatch={onWatch}
      onAddFriend={onAddFriend}
      onRemoveFriend={onRemoveFriend}
      challengeBusy={challengeBusy}
      friendBusy={friendBusy}
      addFriendBusy={addFriendBusy}
      removeFriendBusy={removeFriendBusy}
      signedIn={signedIn}
      isFriend={isFriend}
      requestPendingOutgoing={requestPendingOutgoing}
      requestActions={requestActions}
      onMessage={onMessage}
      onAction={() => setOpen(false)}
    />
  );

  if (!ready) {
    return children;
  }

  const hoverSide = contentSide ?? (narrow ? "top" : "left");
  const hoverAlign = contentAlign ?? "start";
  const touchSide = contentSide ?? (narrow ? "top" : "left");
  const touchAlign = contentAlign ?? "center";

  // Desktop: shadcn HoverCard - call sites pass the name/title control as trigger.
  if (finePointer) {
    return (
      <HoverCard open={open} onOpenChange={setOpen} openDelay={160} closeDelay={120}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardContent
          side={hoverSide}
          align={hoverAlign}
          sideOffset={8}
          collisionPadding={16}
          className={cn(PLAYER_POPOVER_SURFACE)}
        >
          {body}
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Conversation lists: primary click opens the thread; do not steal it with a Popover.
  if (!openOnClick) {
    return children;
  }

  // Touch / coarse pointer: click Popover; prefer top so the card stays in the mobile viewport.
  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={touchSide}
        align={touchAlign}
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        className={cn(PLAYER_POPOVER_SURFACE)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
