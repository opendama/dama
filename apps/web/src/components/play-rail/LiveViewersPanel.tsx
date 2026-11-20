"use client";

import { ComposeMessageModal, type MessageTarget } from "@/components/chat/ComposeMessageModal";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { PlayerListRow, type RailPlayer } from "@/components/play-rail/PlayerListRow";
import {
  type PlayerSearchSuggestion,
  PlayerSearchTypeahead,
} from "@/components/play-rail/PlayerSearchTypeahead";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { InfiniteListEnd } from "@/components/ui/InfiniteListEnd";
import { Button } from "@/components/ui/button";
import { PlayRailListSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  useAddFriendMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useRemoveFriendMutation,
} from "@/hooks/query/useFriendsQuery";
import { useGameSpectatorsInfinite } from "@/hooks/query/useGameSpectatorsQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfinitePanelScroll } from "@/hooks/useInfinitePanelScroll";
import { parseSearchDebounceMs } from "@/lib/play-rail-display";
import {
  playRailInnerListScrollClass,
  playRailPanelClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Props = {
  chrome: PlayRailChromeReady;
  gameId: string;
  onBack: () => void;
  onChallenge?: (player: RailPlayer) => void;
  onWatch?: (gameId: string) => void;
  signedIn?: boolean;
};

function mapViewer(p: {
  id: string;
  username: string;
  rating: number;
  xp?: number;
  wins: number;
  losses: number;
  region?: string | null;
  country_code?: string | null;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  online?: boolean;
  playing?: boolean;
  playing_game_id?: string | null;
  level_label?: string | null;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
}): RailPlayer {
  return {
    id: p.id,
    username: p.username,
    rating: p.rating,
    xp: typeof p.xp === "number" ? p.xp : 0,
    wins: p.wins,
    losses: p.losses,
    region: p.region,
    countryCode: p.country_code,
    avatarThumbUrl: p.avatar_thumb_url,
    avatarFullUrl: p.avatar_full_url,
    online: Boolean(p.online),
    playing: Boolean(p.playing),
    playingGameId: p.playing_game_id ?? null,
    levelLabel: p.level_label,
    hostTrustTier: p.host_trust_tier ?? null,
    hostTrustBadge: p.host_trust_badge ?? null,
  };
}

export function LiveViewersPanel({
  chrome,
  gameId,
  onBack,
  onChallenge,
  onWatch,
  signedIn,
}: Props) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [q, setQ] = useState("");
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<RailPlayer | null>(null);
  const debouncedQ = useDebouncedValue(q, parseSearchDebounceMs(chrome.search_debounce_ms));
  const pageSize = parseListPageSize(chrome.list_page_size);
  const query = useGameSpectatorsInfinite(gameId, pageSize, true, debouncedQ);
  const friendsQuery = useFriendsQuery(signedIn ? token : null, { poll: true });
  const requestsQuery = useFriendRequestsQuery(signedIn ? token : null, { poll: true });
  const addFriend = useAddFriendMutation(token);
  const removeFriend = useRemoveFriendMutation(token);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listSentinelRef = useRef<HTMLDivElement | null>(null);
  const friendsReady = !signedIn || friendsQuery.isSuccess;
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

  const players = useMemo(() => {
    // Server already filtered by q across the full spectator roster.
    const pages = query.data?.pages ?? [];
    const out: RailPlayer[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const row of page.viewers ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(mapViewer(row));
      }
    }
    return out;
  }, [query.data?.pages]);

  /** Typeahead from server-filtered roster pages (drained while q is active). */
  const typeaheadLocal = useMemo((): PlayerSearchSuggestion[] => {
    return players.map((p) => ({
      id: p.id,
      username: p.username,
      rating: p.rating,
      country_code: p.countryCode,
      avatar_thumb_url: p.avatarThumbUrl,
      online: p.online,
      playing: p.playing,
      host_trust_badge: p.hostTrustBadge ?? null,
      host_trust_tier: p.hostTrustTier ?? null,
    }));
  }, [players]);

  const fetchNextPage = useCallback(() => {
    void query.fetchNextPage();
  }, [query.fetchNextPage]);

  // Debounce panel ranks localSuggestions from loaded pages. While q is active,
  // drain every server-filtered page so the dropdown is not first-page-only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pages.length retriggers drain after each fetch
  useEffect(() => {
    if (!debouncedQ.trim()) return;
    if (!query.hasNextPage || query.isFetchingNextPage || query.isPending || query.isError) {
      return;
    }
    void query.fetchNextPage();
  }, [
    debouncedQ,
    query.hasNextPage,
    query.isFetchingNextPage,
    query.isPending,
    query.isError,
    query.data?.pages.length,
    query.fetchNextPage,
  ]);

  useInfinitePanelScroll({
    enabled: pageSize > 0 && !query.isPending && !query.isError,
    scrollRef: listScrollRef,
    sentinelRef: listSentinelRef,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage,
    // Rebind when search changes so pages restart from skip=0 for the new q.
    layoutKey: `${gameId}:${debouncedQ}`,
  });

  const loading = query.isPending || pageSize <= 0;

  return (
    <div className={playRailPanelClass}>
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
      <PlayerProfileModal
        open={Boolean(profilePlayer)}
        onOpenChange={(v) => {
          if (!v) setProfilePlayer(null);
        }}
        player={profilePlayer}
        onChallenge={(pl) => {
          setProfilePlayer(null);
          onChallenge?.(pl as RailPlayer);
        }}
      />
      <div className={cn(playRailStickySubClass, "border-b-0")}>
        <div className="flex items-center gap-2 border-b border-[var(--dama-border)] px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {chrome.back_to_live_games}
          </Button>
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--dama-text)]">
            {chrome.live_viewers_title}
          </p>
        </div>
        <div className="flex items-center gap-2 border-b border-[var(--dama-border)] px-3 py-2">
          <PlayerSearchTypeahead
            chrome={chrome}
            value={q}
            onValueChange={setQ}
            placeholder={chrome.search_username_placeholder}
            serverSearch={false}
            localSuggestions={typeaheadLocal}
            onSelect={(p) => {
              setQ(p.username);
              setProfilePlayer(
                mapViewer({
                  id: p.id,
                  username: p.username,
                  rating: p.rating,
                  wins: 0,
                  losses: 0,
                  country_code: p.country_code,
                  avatar_thumb_url: p.avatar_thumb_url,
                  online: p.online,
                  playing: p.playing,
                  host_trust_badge: p.host_trust_badge,
                  host_trust_tier: p.host_trust_tier,
                }),
              );
            }}
          />
          <span className="shrink-0 text-xs font-medium text-[var(--dama-muted)]">
            {chrome.label_rating}
          </span>
        </div>
      </div>
      <PlayRailScrollPort ref={listScrollRef}>
        <div className={playRailInnerListScrollClass}>
          {loading ? (
            <PlayRailListSkeleton variant="player" rows={8} />
          ) : players.length === 0 ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.empty_live_viewers}</p>
          ) : (
            <ul>
              {players.map((p) => (
                <li key={p.id}>
                  <PlayerListRow
                    chrome={chrome}
                    player={p}
                    signedIn={signedIn}
                    onChallenge={onChallenge}
                    onWatch={onWatch}
                    onActivate={(pl) => setProfilePlayer(pl)}
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
                    isFriend={friendsReady ? friendIds.has(p.id) : undefined}
                    requestPendingOutgoing={outgoingPendingIds.has(p.id)}
                    friendBusy={addFriend.isPending || removeFriend.isPending}
                    addFriendBusy={addFriend.isPending && addFriend.variables === p.id}
                    removeFriendBusy={removeFriend.isPending && removeFriend.variables === p.id}
                    onAddFriend={
                      friendsReady && !outgoingPendingIds.has(p.id) && !friendIds.has(p.id)
                        ? (pl) => {
                            void (async () => {
                              try {
                                await addFriend.mutateAsync(pl.id);
                                toast.success(chrome.toast_friend_request_sent);
                              } catch (e) {
                                const msg =
                                  e && typeof e === "object" && "response" in e
                                    ? String(
                                        (e as { response?: { data?: { error?: string } } }).response
                                          ?.data?.error ?? "",
                                      )
                                    : "";
                                if (msg === "already_friends") {
                                  toast.error(chrome.friend_request_already_friends);
                                } else {
                                  toast.error(chrome.toast_friend_request_failed);
                                }
                              }
                            })();
                          }
                        : undefined
                    }
                    onRemoveFriend={
                      friendsReady && friendIds.has(p.id)
                        ? (pl) => {
                            void (async () => {
                              try {
                                await removeFriend.mutateAsync(pl.id);
                                toast.success(chrome.toast_friend_removed);
                              } catch {
                                toast.error(chrome.toast_friend_failed);
                              }
                            })();
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <InfiniteListEnd
            sentinelRef={listSentinelRef}
            loading={query.isFetchingNextPage}
            loadingLabel={chrome.loading_more}
          />
        </div>
      </PlayRailScrollPort>
    </div>
  );
}
