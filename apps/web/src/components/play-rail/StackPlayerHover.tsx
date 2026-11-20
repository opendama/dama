"use client";

import { ComposeMessageModal, type MessageTarget } from "@/components/chat/ComposeMessageModal";
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
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Mail, Swords, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from "react";

export type StackHoverPlayer = {
  id: string;
  username: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  countryCode?: string | null;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
  online?: boolean;
  playing?: boolean;
  hostTrustBadge?: string | null;
  hostTrustTier?: string | null;
};

function stackToRail(player: StackHoverPlayer): RailPlayer {
  // Never invent W/L/D/rating/xp zeros when seat payload omits them.
  return {
    id: player.id,
    username: player.username,
    rating: typeof player.rating === "number" ? player.rating : Number.NaN,
    xp: Number.NaN,
    wins: typeof player.wins === "number" ? player.wins : Number.NaN,
    losses: typeof player.losses === "number" ? player.losses : Number.NaN,
    draws: typeof player.draws === "number" ? player.draws : undefined,
    countryCode: player.countryCode,
    avatarThumbUrl: player.avatarThumbUrl,
    avatarFullUrl: player.avatarFullUrl,
    online: player.online,
    playing: player.playing,
    hostTrustBadge: player.hostTrustBadge,
    hostTrustTier: player.hostTrustTier,
  };
}

function railToStack(player: RailPlayer): StackHoverPlayer {
  return {
    id: player.id,
    username: player.username,
    rating: player.rating,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    countryCode: player.countryCode,
    avatarThumbUrl: player.avatarThumbUrl,
    avatarFullUrl: player.avatarFullUrl,
    online: player.online,
    playing: player.playing,
    hostTrustBadge: player.hostTrustBadge,
    hostTrustTier: player.hostTrustTier,
  };
}

type Props = {
  chrome: PlayRailChromeReady;
  player: StackHoverPlayer;
  children: ReactElement;
  signedIn?: boolean;
  onMessage?: (player: StackHoverPlayer) => void;
  onChallenge?: (player: StackHoverPlayer) => void;
  onAddFriend?: (player: StackHoverPlayer) => void;
  onRemoveFriend?: (player: StackHoverPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
  isFriend?: boolean;
  requestPendingOutgoing?: boolean;
};

function useFinePointerHover() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

function Body({
  chrome,
  player,
  presenceReady = true,
  signedIn,
  onMessage,
  onChallenge,
  onAddFriend,
  onRemoveFriend,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  isFriend,
  requestPendingOutgoing,
  onAction,
}: {
  chrome: PlayRailChromeReady;
  player: StackHoverPlayer;
  presenceReady?: boolean;
  signedIn?: boolean;
  onMessage?: (player: StackHoverPlayer) => void;
  onChallenge?: (player: StackHoverPlayer) => void;
  onAddFriend?: (player: StackHoverPlayer) => void;
  onRemoveFriend?: (player: StackHoverPlayer) => void;
  challengeBusy?: boolean;
  friendBusy?: boolean;
  addFriendBusy?: boolean;
  removeFriendBusy?: boolean;
  isFriend?: boolean;
  requestPendingOutgoing?: boolean;
  onAction?: () => void;
}) {
  const href = playerProfileHref(player.id);
  const viewLabel = (chrome.view_profile_action || "").trim();
  const wins = player.wins;
  const losses = player.losses;
  const draws = player.draws;
  const hasRecord =
    typeof wins === "number" && typeof losses === "number" && typeof draws === "number";
  const played = hasRecord ? wins + losses + draws : null;
  const showMessage = Boolean(signedIn && onMessage);
  const showFriendToggle =
    (onAddFriend || onRemoveFriend) && !requestPendingOutgoing && isFriend !== undefined;
  const showChallenge = Boolean(onChallenge);

  // Prefer PlayerHoverCard on Games/Watch seats; this lean card keeps rounded-md face parity.
  const avatar = (
    <span className="relative h-14 w-14 shrink-0 rounded-md">
      <DamaUserAvatar
        src={player.avatarFullUrl || player.avatarThumbUrl}
        className="h-14 w-14 rounded-md"
      />
      {presenceReady ? (
        <OnlineStatusDot
          online={Boolean(player.online)}
          playing={Boolean(player.playing)}
          size="md"
        />
      ) : null}
    </span>
  );

  const name = (
    <span className="truncate font-semibold text-[var(--dama-text)] hover:underline">
      {formatPlayerNameDisplay(
        player.username,
        chrome.live_player_name_max_chars,
        chrome.name_truncate_suffix,
      )}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {avatar}
          </a>
        ) : (
          avatar
        )}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate">
                {name}
              </a>
            ) : (
              name
            )}
            {player.rating != null ? (
              <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                {chrome.rating_paren_open}
                {player.rating}
                {chrome.rating_paren_close}
              </span>
            ) : null}
            <CountryFlag code={player.countryCode} />
          </p>
          {(player.hostTrustBadge || "").trim() ? (
            <HostTrustBadge
              label={player.hostTrustBadge}
              tier={player.hostTrustTier}
              className="mt-1 text-[10px]"
            />
          ) : null}
          {hasRecord && played != null ? (
            <p className="mt-1 text-xs tabular-nums text-[var(--dama-muted)]">
              {played}
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
          {requestPendingOutgoing ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.friend_request_outgoing_label}
            </p>
          ) : null}
          {href && viewLabel ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded border border-[var(--dama-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)] transition-colors hover:border-[var(--dama-text)] hover:bg-[var(--dama-surface)] hover:text-[var(--dama-text)]"
            >
              {viewLabel}
            </a>
          ) : null}
        </div>
      </div>
      {showMessage || showFriendToggle || showChallenge ? (
        <div className="flex flex-col gap-1.5">
          {showFriendToggle ? (
            <Button
              type="button"
              variant="outline"
              className={cn(PLAYER_POPOVER_CTA)}
              aria-label={
                isFriend ? chrome.remove_friend_action : chrome.send_friend_request_action
              }
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
          {showChallenge ? (
            <Button
              type="button"
              variant="play"
              className={cn(PLAYER_POPOVER_CTA)}
              disabled={!signedIn || challengeBusy}
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Compact bio hover/tap for overlapping stack avatars - All Players card parity. */
export function StackPlayerHover({
  chrome,
  player,
  children,
  signedIn,
  onMessage,
  onChallenge,
  onAddFriend,
  onRemoveFriend,
  challengeBusy,
  friendBusy,
  addFriendBusy,
  removeFriendBusy,
  isFriend,
  requestPendingOutgoing,
}: Props) {
  const router = useRouter();
  const fine = useFinePointerHover();
  const token = useAuthStore((s) => s.token);
  const authed = signedIn ?? Boolean(token);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  useEffect(() => setReady(true), []);

  const liveQuery = usePublicPlayerQuery(player.id, open && Boolean(player.id));
  const displayPlayer = useMemo(
    () => railToStack(mergeRailPlayerFromPublic(stackToRail(player), liveQuery.data)),
    [player, liveQuery.data],
  );
  const presenceReady =
    typeof player.online === "boolean" || liveQuery.isSuccess || liveQuery.isError;

  const handleMessage =
    onMessage ??
    ((p: StackHoverPlayer) => {
      setMessageTarget({
        id: p.id,
        username: p.username,
        avatarThumbUrl: p.avatarThumbUrl,
        avatarFullUrl: p.avatarFullUrl,
      });
    });

  const body: ReactNode = (
    <Body
      chrome={chrome}
      player={displayPlayer}
      presenceReady={presenceReady}
      signedIn={authed}
      onMessage={authed ? handleMessage : undefined}
      onChallenge={onChallenge}
      onAddFriend={onAddFriend}
      onRemoveFriend={onRemoveFriend}
      challengeBusy={challengeBusy}
      friendBusy={friendBusy}
      addFriendBusy={addFriendBusy}
      removeFriendBusy={removeFriendBusy}
      isFriend={isFriend}
      requestPendingOutgoing={requestPendingOutgoing}
      onAction={() => setOpen(false)}
    />
  );

  const modal = (
    <ComposeMessageModal
      chrome={chrome}
      open={Boolean(messageTarget)}
      onOpenChange={(v) => {
        if (!v) setMessageTarget(null);
      }}
      target={messageTarget}
      onComposeStarted={() => {
        setMessageTarget(null);
        setOpen(false);
        router.push("/?rail=players&sub=dms");
      }}
      onOpenedThread={({ threadId }) => {
        setMessageTarget(null);
        setOpen(false);
        const tid = threadId.trim();
        if (!tid) return;
        router.push(`/?rail=players&sub=dms&thread=${encodeURIComponent(tid)}`);
      }}
    />
  );

  if (!ready) return children;

  if (fine) {
    return (
      <>
        {modal}
        <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>{children}</HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="center"
            sideOffset={6}
            className={cn(PLAYER_POPOVER_SURFACE)}
          >
            {body}
          </HoverCardContent>
        </HoverCard>
      </>
    );
  }

  return (
    <>
      {modal}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={6}
          className={cn(PLAYER_POPOVER_SURFACE)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {body}
        </PopoverContent>
      </Popover>
    </>
  );
}
