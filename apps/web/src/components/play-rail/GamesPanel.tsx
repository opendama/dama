"use client";

import { ComposeMessageModal, type MessageTarget } from "@/components/chat/ComposeMessageModal";
import { AvatarStack } from "@/components/play-rail/AvatarStack";
import { LiveGameWatchPopover } from "@/components/play-rail/LiveGameWatchPopover";
import { LiveViewersPanel } from "@/components/play-rail/LiveViewersPanel";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import { PlayerSearchTypeahead } from "@/components/play-rail/PlayerSearchTypeahead";
import type { StackHoverPlayer } from "@/components/play-rail/StackPlayerHover";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { InfiniteListEnd } from "@/components/ui/InfiniteListEnd";
import { PlayRailListSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAddFriendMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useRemoveFriendMutation,
} from "@/hooks/query/useFriendsQuery";
import { type LiveGameRow, useLiveGamesInfinite } from "@/hooks/query/useLiveGamesQuery";
import { type MyMatchRow, useMyMatchesInfinite } from "@/hooks/query/useMyMatchesQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { resetInfiniteScrollTop, useInfinitePanelScroll } from "@/hooks/useInfinitePanelScroll";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay, parseSearchDebounceMs } from "@/lib/play-rail-display";
import {
  playRailInnerListScrollClass,
  playRailPanelClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { shouldToastFriendsMembershipFailure } from "@/lib/query-errors";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Eye, History, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type GamesSub = "watch" | "history";

type Props = {
  chrome: PlayRailChromeReady;
  onWatch: (gameId: string) => void;
  /** Open finished/own match (resume / review via gameId + DB mode). */
  onOpenMatch: (gameId: string, mode?: string) => void;
  onChallenge?: (player: RailPlayer) => void;
  signedIn: boolean;
  /** Map seconds → label from DB match_clock.presets. */
  timeControlLabel?: (seconds: number) => string;
  /** When false, queries pause (panel kept mounted for tab switch parity). */
  active?: boolean;
};

function modeLabel(mode: string | undefined, chrome: PlayRailChromeReady): string {
  const m = (mode || "").trim().toLowerCase();
  if (m === "ai") return chrome.mode_ai;
  if (m === "pvp") return chrome.mode_pvp;
  return "";
}

/** DB `id_truncate_chars` + `id_truncate_suffix` - never invent a fixed slice length. */
function formatGameIdDisplay(id: string, charsRaw: string, suffix: string): string {
  const n = Number.parseInt(charsRaw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return id;
  if (id.length <= n) return id;
  return `${id.slice(0, n)}${suffix}`;
}

function matchOutcome(
  m: MyMatchRow,
  myId: string | undefined,
  chrome: PlayRailChromeReady,
): string {
  if (m.is_draw) return chrome.outcome_draw;
  if (!myId || !m.winner_id) return modeLabel(m.mode, chrome);
  return m.winner_id === myId ? chrome.outcome_win : chrome.outcome_loss;
}

function seatPlayers(g: LiveGameRow): StackHoverPlayer[] {
  const out: StackHoverPlayer[] = [];
  if (g.player1_id && g.player1_username) {
    out.push({
      id: g.player1_id,
      username: g.player1_username,
      rating: g.player1_rating,
      wins: g.player1_wins,
      losses: g.player1_losses,
      draws: g.player1_draws,
      countryCode: g.player1_country_code,
      avatarThumbUrl: g.player1_avatar_thumb_url,
      avatarFullUrl: g.player1_avatar_full_url,
      hostTrustBadge: g.player1_host_trust_badge ?? null,
      hostTrustTier: g.player1_host_trust_tier ?? null,
      // Live seat → playing presence (red). Online comes from viewer hydrate / public-player.
      playing: true,
    });
  }
  if (g.player2_id && g.player2_username) {
    out.push({
      id: g.player2_id,
      username: g.player2_username,
      rating: g.player2_rating,
      wins: g.player2_wins,
      losses: g.player2_losses,
      draws: g.player2_draws,
      countryCode: g.player2_country_code,
      avatarThumbUrl: g.player2_avatar_thumb_url,
      avatarFullUrl: g.player2_avatar_full_url,
      hostTrustBadge: g.player2_host_trust_badge ?? null,
      hostTrustTier: g.player2_host_trust_tier ?? null,
      playing: true,
    });
  }
  return out;
}

function viewerPeople(g: LiveGameRow): StackHoverPlayer[] {
  return (g.viewers ?? []).map((v) => ({
    id: v.id,
    username: v.username,
    rating: v.rating,
    wins: v.wins,
    losses: v.losses,
    draws: v.draws,
    countryCode: v.country_code,
    avatarThumbUrl: v.avatar_thumb_url,
    avatarFullUrl: v.avatar_full_url,
    hostTrustBadge: v.host_trust_badge ?? null,
    hostTrustTier: v.host_trust_tier ?? null,
    // Live spectators are present in the room (not seated as playing).
    online: true,
    playing: false,
  }));
}

function LiveGameRowButton({
  chrome,
  game,
  onWatch,
  onOpenViewers,
  onChallenge,
  signedIn,
  timeControlLabel,
  friendIds,
  outgoingPendingIds,
  friendsReady,
  onAddFriend,
  onRemoveFriend,
  friendBusy,
  addFriendBusyId,
  removeFriendBusyId,
  challengeBusy,
}: {
  chrome: PlayRailChromeReady;
  game: LiveGameRow;
  onWatch: (gameId: string) => void;
  onOpenViewers: (gameId: string) => void;
  onChallenge?: (player: RailPlayer) => void;
  signedIn: boolean;
  timeControlLabel?: (seconds: number) => string;
  friendIds: Set<string>;
  outgoingPendingIds: Set<string>;
  friendsReady: boolean;
  onAddFriend: (id: string) => void;
  onRemoveFriend: (id: string) => void;
  friendBusy: boolean;
  addFriendBusyId?: string;
  removeFriendBusyId?: string;
  challengeBusy?: boolean;
}) {
  const router = useRouter();
  const seats = seatPlayers(game);
  const viewers = viewerPeople(game);
  // Prefer API spectator_count; only fall to known face count when the field is absent (not invent 0).
  const spectatorCount =
    typeof game.spectator_count === "number" ? game.spectator_count : viewers.length;

  const toRail = (p: StackHoverPlayer): RailPlayer => ({
    id: p.id,
    username: p.username,
    // Never invent W/L/D/rating/xp zeros when seat payload omits them.
    rating: typeof p.rating === "number" ? p.rating : Number.NaN,
    xp: Number.NaN,
    wins: typeof p.wins === "number" ? p.wins : Number.NaN,
    losses: typeof p.losses === "number" ? p.losses : Number.NaN,
    draws: typeof p.draws === "number" ? p.draws : undefined,
    countryCode: p.countryCode,
    avatarThumbUrl: p.avatarThumbUrl,
    avatarFullUrl: p.avatarFullUrl,
    online: p.online,
    playing: p.playing ?? true,
    // Enables … → Watch in PlayerHoverCard (same CTA row as All Players).
    playingGameId: game.id,
  });

  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);

  // Exact All Players hover card (PlayerHoverCard) - not the lean stack bio.
  const wrapSeatFace = (person: StackHoverPlayer, face: ReactNode) => {
    const outgoingPending = outgoingPendingIds.has(person.id);
    const isFriend = friendsReady ? friendIds.has(person.id) : undefined;
    const rail = toRail(person);
    return (
      <PlayerHoverCard
        chrome={chrome}
        player={rail}
        signedIn={signedIn}
        onChallenge={onChallenge}
        onWatch={onWatch}
        challengeBusy={challengeBusy}
        isFriend={isFriend}
        requestPendingOutgoing={outgoingPending}
        // Seat stack sits on the rail's left edge - open into the row so the
        // card avatar stays top-left like All Players (not collision-flipped).
        contentSide="right"
        contentAlign="start"
        onAddFriend={
          friendsReady && !outgoingPending && isFriend === false
            ? (pl) => onAddFriend(pl.id)
            : undefined
        }
        onRemoveFriend={
          friendsReady && isFriend === true ? (pl) => onRemoveFriend(pl.id) : undefined
        }
        friendBusy={friendBusy}
        addFriendBusy={addFriendBusyId === person.id}
        removeFriendBusy={removeFriendBusyId === person.id}
        onMessage={
          signedIn
            ? (pl) =>
                setMessageTarget({
                  id: pl.id,
                  username: pl.username,
                  avatarThumbUrl: pl.avatarThumbUrl,
                  avatarFullUrl: pl.avatarFullUrl,
                })
            : undefined
        }
      >
        <span className="inline-flex cursor-pointer rounded-md">{face}</span>
      </PlayerHoverCard>
    );
  };
  const p1 = formatPlayerNameDisplay(
    (game.player1_username || "").trim(),
    chrome.live_player_name_max_chars,
    chrome.name_truncate_suffix,
  );
  const p2 = formatPlayerNameDisplay(
    (game.player2_username || "").trim(),
    chrome.live_player_name_max_chars,
    chrome.name_truncate_suffix,
  );
  const tc =
    game.time_control_seconds != null && game.time_control_seconds > 0 && timeControlLabel
      ? timeControlLabel(game.time_control_seconds)
      : "";
  const moveCount =
    typeof game.move_count === "number" && Number.isFinite(game.move_count)
      ? game.move_count
      : null;
  const shortId = formatGameIdDisplay(game.id, chrome.id_truncate_chars, chrome.id_truncate_suffix);

  // Seat + viewer faces stay outside the Watch HoverCard so bio hover never fights QR popover.
  return (
    <div className="flex w-full items-start gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5 transition-colors hover:bg-[var(--dama-hover)]">
      <ComposeMessageModal
        chrome={chrome}
        open={Boolean(messageTarget)}
        onOpenChange={(v) => {
          if (!v) setMessageTarget(null);
        }}
        target={messageTarget}
        onComposeStarted={() => {
          setMessageTarget(null);
          router.push("/?rail=players&sub=dms");
        }}
        onOpenedThread={({ threadId }) => {
          setMessageTarget(null);
          const tid = threadId.trim();
          if (!tid) return;
          router.push(`/?rail=players&sub=dms&thread=${encodeURIComponent(tid)}`);
        }}
      />
      <AvatarStack
        people={seats}
        max={2}
        size="md"
        faceShape="rounded"
        overflowPrefix={chrome.viewers_overflow_prefix}
        renderFace={(person, face) => wrapSeatFace(person, face)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Order: players → viewers → game id (spec). Watch popover opens from names only. */}
        <div className="flex w-full items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.label_players}
            </p>
            <LiveGameWatchPopover
              chrome={chrome}
              game={game}
              onJoin={onWatch}
              onChallenge={onChallenge}
              signedIn={signedIn}
              friendIds={friendIds}
              outgoingPendingIds={outgoingPendingIds}
              friendsReady={friendsReady}
              onAddFriend={onAddFriend}
              onRemoveFriend={onRemoveFriend}
              friendBusy={friendBusy}
              addFriendBusyId={addFriendBusyId}
              removeFriendBusyId={removeFriendBusyId}
              challengeBusy={challengeBusy}
            >
              <button
                type="button"
                className="flex min-w-0 max-w-full items-center truncate text-left text-sm font-semibold text-[var(--dama-text)] hover:underline"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <span className="truncate">{p1}</span>
                  <CountryFlag code={seats[0]?.countryCode} />
                  <HostTrustBadge
                    label={seats[0]?.hostTrustBadge}
                    tier={seats[0]?.hostTrustTier}
                    className="shrink-0 text-[9px]"
                  />
                </span>
                <span className="mx-1 shrink-0 font-normal text-[var(--dama-muted)]">
                  {chrome.vs_separator}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <span className="truncate">{p2}</span>
                  <CountryFlag code={seats[1]?.countryCode} />
                  <HostTrustBadge
                    label={seats[1]?.hostTrustBadge}
                    tier={seats[1]?.hostTrustTier}
                    className="shrink-0 text-[9px]"
                  />
                </span>
              </button>
            </LiveGameWatchPopover>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-[var(--dama-muted)]">
            {tc ? (
              <span className="flex items-center gap-1 text-[var(--dama-playing)]">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                {tc}
              </span>
            ) : moveCount != null ? (
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-[var(--dama-playing)]" aria-hidden />
                {moveCount} {chrome.moves_suffix}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-visible">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
            {chrome.label_viewers}
          </span>
          {spectatorCount > 0 ? (
            <button
              type="button"
              className="shrink-0 overflow-visible rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dama-brand)]"
              aria-label={chrome.live_viewers_title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenViewers(game.id);
              }}
            >
              <AvatarStack
                people={viewers}
                max={3}
                size="sm"
                totalCount={spectatorCount}
                overflowPrefix={chrome.viewers_overflow_prefix}
                className="pointer-events-none overflow-visible"
              />
            </button>
          ) : (
            <span className="text-xs tabular-nums text-[var(--dama-muted)]">
              {chrome.viewers_empty_count}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-[var(--dama-muted)]">
          <span className="font-semibold uppercase tracking-wide">{chrome.label_game_id}</span>
          <span className="ml-1 font-mono tabular-nums text-[var(--dama-text)]">{shortId}</span>
        </p>
      </div>
    </div>
  );
}

export function GamesPanel({
  chrome,
  onWatch,
  onOpenMatch,
  onChallenge,
  signedIn,
  timeControlLabel,
  active = true,
}: Props) {
  const token = useAuthStore((s) => s.token);
  const myId = useAuthStore((s) => s.user?.id);
  const [sub, setSub] = useState<GamesSub>("watch");
  const [viewersGameId, setViewersGameId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, parseSearchDebounceMs(chrome.search_debounce_ms));
  const pageSize = parseListPageSize(chrome.list_page_size);
  const liveQuery = useLiveGamesInfinite(
    pageSize,
    active && sub === "watch" && !viewersGameId,
    debouncedQ,
  );
  const historyQuery = useMyMatchesInfinite(
    signedIn ? token : null,
    pageSize,
    active && sub === "history",
    debouncedQ,
  );
  const friendsQuery = useFriendsQuery(signedIn && active ? token : null, {
    poll: active,
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestsQuery = useFriendRequestsQuery(signedIn && active ? token : null, {
    poll: active,
  });
  const addFriend = useAddFriendMutation(token);
  const removeFriend = useRemoveFriendMutation(token);
  const friendsReady = !signedIn || friendsQuery.isSuccess;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset scroll when tab/search changes
  useEffect(() => {
    if (!active) return;
    resetInfiniteScrollTop(scrollRef);
  }, [active, sub, debouncedQ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: toast on isLoadingError edge only
  useEffect(() => {
    if (!signedIn || !shouldToastFriendsMembershipFailure(friendsQuery)) return;
    const msg = (chrome.toast_friend_failed || "").trim();
    if (msg) toast.error(msg);
  }, [signedIn, friendsQuery.isLoadingError, chrome.toast_friend_failed]);
  const friendIds = useMemo(
    () => new Set((friendsQuery.data ?? []).map((f) => f.id)),
    [friendsQuery.data],
  );
  const outgoingPendingIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of requestsQuery.data?.outgoing ?? []) {
      if (row.status === "pending" && row.to_user_id) set.add(row.to_user_id);
    }
    return set;
  }, [requestsQuery.data?.outgoing]);

  const live = useMemo(() => {
    const pages = liveQuery.data?.pages ?? [];
    const out: LiveGameRow[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const g of page.games ?? []) {
        if (!g?.id || seen.has(g.id)) continue;
        seen.add(g.id);
        out.push(g);
      }
    }
    return out;
  }, [liveQuery.data?.pages]);
  const history = useMemo(() => {
    const pages = historyQuery.data?.pages ?? [];
    const out: MyMatchRow[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const m of page.matches ?? []) {
        if (!m?.id || seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
      }
    }
    return out;
  }, [historyQuery.data?.pages]);

  const activeInfinite = sub === "watch" ? liveQuery : historyQuery;
  const fetchNextPage = useCallback(() => {
    void activeInfinite.fetchNextPage();
  }, [activeInfinite.fetchNextPage]);

  useInfinitePanelScroll({
    enabled:
      active &&
      !viewersGameId &&
      pageSize > 0 &&
      !activeInfinite.isError &&
      ((sub === "watch" && !liveQuery.isPending) ||
        (sub === "history" && signedIn && !historyQuery.isPending)),
    scrollRef,
    sentinelRef,
    hasNextPage: Boolean(activeInfinite.hasNextPage),
    isFetchingNextPage: activeInfinite.isFetchingNextPage,
    fetchNextPage,
    // Rebind when search changes so pages restart from skip=0 for the new q.
    layoutKey: `${sub}:${viewersGameId ? "viewers" : "list"}:${debouncedQ}`,
  });

  const handleAddFriend = (id: string) => {
    void (async () => {
      try {
        await addFriend.mutateAsync(id);
        toast.success(chrome.toast_friend_request_sent);
      } catch (e) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? String(
                (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "",
              )
            : "";
        if (msg === "already_friends") {
          toast.error(chrome.friend_request_already_friends);
        } else {
          toast.error(chrome.toast_friend_request_failed);
        }
      }
    })();
  };
  const handleRemoveFriend = (id: string) => {
    void (async () => {
      try {
        await removeFriend.mutateAsync(id);
        toast.success(chrome.toast_friend_removed);
      } catch {
        toast.error(chrome.toast_friend_request_failed);
      }
    })();
  };

  if (viewersGameId) {
    return (
      <LiveViewersPanel
        chrome={chrome}
        gameId={viewersGameId}
        signedIn={signedIn}
        onBack={() => setViewersGameId(null)}
        onChallenge={onChallenge}
        onWatch={onWatch}
      />
    );
  }

  return (
    <div className={playRailPanelClass}>
      <div className={cn(playRailStickySubClass, "border-b-0")}>
        <div
          className="grid grid-cols-2 border-b border-[var(--dama-border)]"
          role="tablist"
          aria-label={chrome.tab_games}
        >
          {(
            [
              { id: "watch" as const, label: chrome.sub_watch, icon: Eye },
              { id: "history" as const, label: chrome.sub_history, icon: History },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sub === t.id}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold sm:text-sm",
                sub === t.id
                  ? "border-b-2 border-[var(--dama-text)] text-[var(--dama-text)]"
                  : "border-b-2 border-transparent text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
              )}
              onClick={() => {
                setViewersGameId(null);
                setQ("");
                setSub(t.id);
              }}
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--dama-border)] px-3 py-2">
          {/*
            Debounce panel must hit GET /players?q= (relevance-ranked), never the already-loaded
            live-game page. Selecting a username drives list q on /games/live or /matches/me.
          */}
          <PlayerSearchTypeahead
            chrome={chrome}
            value={q}
            onValueChange={setQ}
            placeholder={
              sub === "watch"
                ? chrome.search_username_placeholder || ""
                : chrome.search_opponent_placeholder || chrome.search_username_placeholder || ""
            }
            enabled={sub === "watch" || signedIn}
            serverSearch
            onSelect={(p) => setQ(p.username)}
          />
        </div>
      </div>

      <PlayRailScrollPort ref={scrollRef}>
        <div className={playRailInnerListScrollClass}>
          {sub === "watch" ? (
            liveQuery.isPending || pageSize <= 0 ? (
              <PlayRailListSkeleton variant="game" rows={7} />
            ) : live.length === 0 ? (
              <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.empty_live_games}</p>
            ) : (
              <ul>
                {live.map((g) => (
                  <li key={g.id}>
                    <LiveGameRowButton
                      chrome={chrome}
                      game={g}
                      onWatch={onWatch}
                      onOpenViewers={setViewersGameId}
                      onChallenge={onChallenge}
                      signedIn={signedIn}
                      timeControlLabel={timeControlLabel}
                      friendIds={friendIds}
                      outgoingPendingIds={outgoingPendingIds}
                      friendsReady={friendsReady}
                      onAddFriend={handleAddFriend}
                      onRemoveFriend={handleRemoveFriend}
                      friendBusy={addFriend.isPending || removeFriend.isPending}
                      addFriendBusyId={addFriend.isPending ? addFriend.variables : undefined}
                      removeFriendBusyId={
                        removeFriend.isPending ? removeFriend.variables : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )
          ) : !signedIn ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.sign_in_history}</p>
          ) : historyQuery.isPending || pageSize <= 0 ? (
            <PlayRailListSkeleton variant="game" rows={7} />
          ) : history.length === 0 ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.empty_history}</p>
          ) : (
            <ul>
              {history.map((m) => {
                const gameId = (m.game_id || "").trim();
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--dama-hover)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!gameId) {
                          toast.error(chrome.toast_game_unavailable);
                          return;
                        }
                        const mode = (m.mode || "").trim().toLowerCase();
                        if (mode !== "ai" && mode !== "pvp") {
                          toast.error(chrome.toast_game_unavailable);
                          return;
                        }
                        onOpenMatch(gameId, mode);
                      }}
                      aria-label={chrome.resume_game_action}
                    >
                      <span className="min-w-0 truncate text-[var(--dama-muted)]">
                        {modeLabel(m.mode, chrome)}
                        {m.move_count != null
                          ? `${chrome.meta_separator}${m.move_count} ${chrome.moves_suffix}`
                          : ""}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--dama-text)]">
                        {matchOutcome(m, myId, chrome)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <InfiniteListEnd
            sentinelRef={sentinelRef}
            loading={activeInfinite.isFetchingNextPage}
            loadingLabel={chrome.loading_more}
          />
        </div>
      </PlayRailScrollPort>
    </div>
  );
}
