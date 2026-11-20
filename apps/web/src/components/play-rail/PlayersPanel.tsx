"use client";

import { ChatBubble, chatThreadChromeFrom } from "@/components/chat/ChatThreadUI";
import { ComposeMessageModal, type MessageTarget } from "@/components/chat/ComposeMessageModal";
import { DMThreadPanel } from "@/components/chat/DMThreadPanel";
import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { PlayRailScrollPort } from "@/components/play-rail/PlayRailScrollPort";
import { PlayerHoverCard } from "@/components/play-rail/PlayerHoverCard";
import { PlayerListRow, type RailPlayer } from "@/components/play-rail/PlayerListRow";
import {
  type PlayerSearchSuggestion,
  PlayerSearchTypeahead,
} from "@/components/play-rail/PlayerSearchTypeahead";
import { PlayerProfileModal } from "@/components/player/PlayerProfileModal";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { InfiniteListEnd } from "@/components/ui/InfiniteListEnd";
import { Button } from "@/components/ui/button";
import { PlayRailListSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  type DMRequestRow,
  fetchDMRequest,
  probeDMThreadAccess,
  useAcceptDMMutation,
  useCancelDMMutation,
  useDMRequestsInfinite,
  useDMRequestsQuery,
  useDenyDMMutation,
  useSendDMMutation,
} from "@/hooks/query/useDMsQuery";
import {
  useAcceptFriendRequestMutation,
  useAddFriendMutation,
  useCancelFriendRequestMutation,
  useDenyFriendRequestMutation,
  useFriendRequestsInfinite,
  useFriendRequestsQuery,
  useFriendsInfinite,
  useFriendsQuery,
  useRemoveFriendMutation,
} from "@/hooks/query/useFriendsQuery";
import {
  type PlayersSearchRow,
  usePlayersSearchInfinite,
} from "@/hooks/query/usePlayersSearchQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { resetInfiniteScrollTop, useInfinitePanelScroll } from "@/hooks/useInfinitePanelScroll";
import {
  dropChatOutboxMatchingServer,
  loadChatOutbox,
  updateChatOutboxItem,
} from "@/lib/chat-outbox";
import { CountryFlag } from "@/lib/country-flag";
import { formatDmUnreadBadge } from "@/lib/dm-unread-badge";
import { formatPlayerNameDisplay, parseSearchDebounceMs } from "@/lib/play-rail-display";
import { playerProfileHref } from "@/lib/player-profile-href";
import {
  playRailInnerListScrollClass,
  playRailPanelClass,
  playRailStickySubClass,
} from "@/lib/player-shell-ui";
import { shouldToastFriendsMembershipFailure } from "@/lib/query-errors";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function parseListPageSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type PlayersSub = "friends" | "requests" | "dms" | "all";

type Props = {
  chrome: PlayRailChromeReady;
  signedIn: boolean;
  onChallenge: (player: RailPlayer) => void;
  onWatch: (gameId: string) => void;
  challengeBusy?: boolean;
  /** Deep-link from notification href `sub=` (friends | requests | dms | all). */
  initialSub?: PlayersSub;
  /** Open a specific DM request by id (`?dm=`). */
  initialDmRequestId?: string | null;
  /** Open a thread by id (`?thread=`). */
  initialDmThreadId?: string | null;
  /** When false, list queries pause (panel kept mounted for tab switch parity). */
  active?: boolean;
};

function mapRow(p: {
  id: string;
  username: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  region?: string | null;
  country_code?: string | null;
  countryCode?: string | null;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
  online?: boolean;
  playing?: boolean;
  playing_game_id?: string | null;
  playingGameId?: string | null;
  level_label?: string | null;
  levelLabel?: string | null;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
  hostTrustTier?: string | null;
  hostTrustBadge?: string | null;
}): RailPlayer {
  return {
    id: p.id,
    username: p.username,
    rating: p.rating,
    xp: p.xp,
    wins: p.wins,
    losses: p.losses,
    region: p.region,
    countryCode: p.countryCode ?? p.country_code,
    avatarThumbUrl: p.avatarThumbUrl ?? p.avatar_thumb_url,
    avatarFullUrl: p.avatarFullUrl ?? p.avatar_full_url,
    online: Boolean(p.online),
    playing: Boolean(p.playing),
    playingGameId: p.playingGameId ?? p.playing_game_id ?? null,
    levelLabel: p.levelLabel ?? p.level_label,
    hostTrustTier: p.hostTrustTier ?? p.host_trust_tier ?? null,
    hostTrustBadge: p.hostTrustBadge ?? p.host_trust_badge ?? null,
  };
}

function parsePlayersSub(raw: string | undefined): PlayersSub | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "friends" || v === "requests" || v === "dms" || v === "all") return v;
  return null;
}

export function PlayersPanel({
  chrome,
  signedIn,
  onChallenge,
  onWatch,
  challengeBusy,
  initialSub,
  initialDmRequestId,
  initialDmThreadId,
  active = true,
}: Props) {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const sendDm = useSendDMMutation(token);
  const bootSub = parsePlayersSub(initialSub) ?? "all";
  const [sub, setSub] = useState<PlayersSub>(bootSub);
  useEffect(() => {
    const next = parsePlayersSub(initialSub);
    if (next) setSub(next);
  }, [initialSub]);
  const [q, setQ] = useState("");
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  /** Peer + optimistic draft while compose POST resolves (modal already closed). */
  const [composeOpening, setComposeOpening] = useState<{
    peerName: string;
    clientId: string;
    body?: string;
    imageUrl?: string | null;
    toUserId?: string;
    localStatus?: "pending" | "failed";
  } | null>(null);
  const [openThread, setOpenThread] = useState<{
    threadId: string;
    peerName: string;
    canCompose: boolean;
    requestId?: string;
    side?: "in" | "out";
    status?: string;
  } | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<RailPlayer | null>(null);
  // Resume durable compose-new outbox after refresh/kill OR when rail becomes active
  // (panel stays mounted while hidden on Games - must re-check outbox, not one-shot).
  useEffect(() => {
    const uid = (userId || "").trim();
    if (!signedIn || !uid || !token || !active || composeOpening || openThread) return;
    const drafts = loadChatOutbox(uid)
      .filter(
        (i) =>
          i.kind === "dm" &&
          !(i.threadId || "").trim() &&
          Boolean((i.toUserId || "").trim()) &&
          (i.status === "pending" || i.status === "failed" || i.status === "sending"),
      )
      .map((i) => (i.status === "sending" ? { ...i, status: "pending" as const } : i));
    if (!drafts.length) return;
    for (const d of drafts) {
      if (d.status === "sending") updateChatOutboxItem(uid, d.clientId, { status: "pending" });
    }
    const draft = drafts.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0];
    if (!draft) return;
    const peerName = (draft.peerName || "").trim();
    if (!peerName) return;
    const failToast = chrome.dm_toast_failed;
    setSub("dms");
    setComposeOpening({
      peerName,
      clientId: draft.clientId,
      body: draft.body,
      imageUrl: draft.imageUrl,
      toUserId: draft.toUserId,
      localStatus: draft.status === "failed" ? "failed" : "pending",
    });
    if (draft.status === "failed") return;
    const toUserId = (draft.toUserId || "").trim();
    if (!toUserId) return;
    sendDm.mutate(
      {
        clientId: draft.clientId,
        to_user_id: toUserId,
        body: draft.body || undefined,
        image_url: draft.imageUrl || undefined,
      },
      {
        onSuccess: (data) => {
          dropChatOutboxMatchingServer(uid, [{ client_id: draft.clientId }]);
          const tid = (data.thread_id || data.message?.thread_id || "").trim();
          if (!tid) {
            updateChatOutboxItem(uid, draft.clientId, { status: "failed" });
            setComposeOpening((prev) =>
              prev && prev.clientId === draft.clientId ? { ...prev, localStatus: "failed" } : prev,
            );
            toast.error(failToast);
            return;
          }
          const reqStatus = (data.request?.status || "").trim();
          const reqId = (data.request?.id || "").trim();
          setComposeOpening(null);
          setOpenThread({
            threadId: tid,
            peerName,
            canCompose: !data.request || reqStatus === "accepted",
            requestId: reqId || undefined,
            side: data.request ? "out" : undefined,
            status: reqStatus || undefined,
          });
        },
        onError: () => {
          updateChatOutboxItem(uid, draft.clientId, { status: "failed" });
          setComposeOpening((prev) =>
            prev && prev.clientId === draft.clientId ? { ...prev, localStatus: "failed" } : prev,
          );
          toast.error(failToast);
        },
      },
    );
  }, [active, chrome.dm_toast_failed, composeOpening, openThread, sendDm, signedIn, token, userId]);
  const debouncedQ = useDebouncedValue(q, parseSearchDebounceMs(chrome.search_debounce_ms));
  const pageSize = parseListPageSize(chrome.list_page_size);
  const playersQuery = usePlayersSearchInfinite(debouncedQ, pageSize, active && sub === "all");
  /**
   * Full membership set (no skip/limit) for Add/Remove Friend CTAs.
   * Pause polling while a DM thread is open - hooks still run under the early
   * return, and toasting every Axios "Network Error" blip was alarming users.
   */
  const friendsQuery = useFriendsQuery(signedIn && active ? token : null, {
    poll: !openThread,
  });
  const friendsListQuery = useFriendsInfinite(
    signedIn ? token : null,
    pageSize,
    active && sub === "friends",
    debouncedQ,
  );
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset scroll when tab/search changes
  useEffect(() => {
    if (!active) return;
    resetInfiniteScrollTop(listScrollRef);
  }, [active, sub, debouncedQ]);
  const listSentinelRef = useRef<HTMLDivElement | null>(null);
  /** Full requests for membership / badges / deep-links (no skip/limit). */
  const requestsQuery = useFriendRequestsQuery(signedIn && active ? token : null, {
    poll: !openThread,
  });
  const friendRequestsListQuery = useFriendRequestsInfinite(
    signedIn ? token : null,
    pageSize,
    active && sub === "requests",
    debouncedQ,
  );
  const dmRequestsQuery = useDMRequestsQuery(signedIn && active ? token : null);
  const dmRequestsListQuery = useDMRequestsInfinite(
    signedIn ? token : null,
    pageSize,
    active && sub === "dms",
    debouncedQ,
  );
  const addFriend = useAddFriendMutation(token);
  const removeFriend = useRemoveFriendMutation(token);
  const acceptReq = useAcceptFriendRequestMutation(token);
  const denyReq = useDenyFriendRequestMutation(token);
  const cancelReq = useCancelFriendRequestMutation(token);
  const acceptDm = useAcceptDMMutation(token);
  const denyDm = useDenyDMMutation(token);
  const cancelDm = useCancelDMMutation(token);
  // One-shot deep-link key so poll/refetch of DM requests cannot re-toast / re-open.
  const dmDeepLinkKeyRef = useRef("");

  useEffect(() => {
    const dmId = (initialDmRequestId || "").trim();
    const threadId = (initialDmThreadId || "").trim();
    if (!dmId && !threadId) {
      dmDeepLinkKeyRef.current = "";
      return;
    }
    const key = `dm:${dmId}|thread:${threadId}`;
    if (dmDeepLinkKeyRef.current === key) return;
    setSub("dms");
    const rows = [
      ...(dmRequestsQuery.data?.incoming ?? []),
      ...(dmRequestsQuery.data?.outgoing ?? []),
    ];
    const myId = useAuthStore.getState().user?.id || "";
    const markDone = () => {
      dmDeepLinkKeyRef.current = key;
    };
    if (dmId) {
      const row = rows.find((r) => r.id === dmId);
      if (row?.thread_id) {
        markDone();
        setOpenThread({
          threadId: row.thread_id,
          peerName: row.player?.username || "",
          canCompose: row.status === "accepted",
          requestId: row.id,
          side: row.side,
          status: row.status,
        });
        return;
      }
      // Fall back to GET /dms/requests/{id} when list page missed the row.
      if (!token) return;
      // Avoid re-entry while in-flight; mark only after settle.
      if (dmDeepLinkKeyRef.current === `${key}:inflight`) return;
      dmDeepLinkKeyRef.current = `${key}:inflight`;
      void fetchDMRequest(token, dmId).then((got) => {
        const tid = (got?.request.thread_id || "").trim();
        if (!tid || !got) {
          markDone();
          toast.error(chrome.dm_open_failed);
          return;
        }
        markDone();
        const side: "in" | "out" = got.request.to_user_id === myId ? "in" : "out";
        setOpenThread({
          threadId: tid,
          peerName: got.player?.username || "",
          canCompose: got.request.status === "accepted",
          requestId: got.request.id,
          side,
          status: got.request.status,
        });
      });
      return;
    }
    if (threadId) {
      const row = rows.find((r) => (r.thread_id || "") === threadId);
      if (row) {
        markDone();
        setOpenThread({
          threadId,
          peerName: row.player?.username || "",
          canCompose: row.status === "accepted",
          requestId: row.id,
          side: row.side,
          status: row.status,
        });
        return;
      }
      if (!token) return;
      if (dmDeepLinkKeyRef.current === `${key}:inflight`) return;
      dmDeepLinkKeyRef.current = `${key}:inflight`;
      void probeDMThreadAccess(token, threadId).then((ok) => {
        if (!ok) {
          markDone();
          toast.error(chrome.dm_open_failed);
          return;
        }
        markDone();
        setOpenThread({
          threadId,
          peerName: "",
          canCompose: true,
        });
      });
    }
  }, [initialDmRequestId, initialDmThreadId, dmRequestsQuery.data, token, chrome.dm_open_failed]);

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

  const allPlayersRows = useMemo(() => {
    const pages = playersQuery.data?.pages ?? [];
    const out: PlayersSearchRow[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const row of page.players ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [playersQuery.data?.pages]);

  const friendsListRows = useMemo(() => {
    const pages = friendsListQuery.data?.pages ?? [];
    const out: PlayersSearchRow[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const row of page.friends ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [friendsListQuery.data?.pages]);

  const players: RailPlayer[] = useMemo(() => {
    if (sub === "friends") {
      // Server already filtered by q - do not re-filter the loaded pages.
      return friendsListRows.map(mapRow);
    }
    return allPlayersRows.map(mapRow);
  }, [allPlayersRows, friendsListRows, sub]);

  const requestRows = useMemo(() => {
    const pages = friendRequestsListQuery.data?.pages ?? [];
    const out: Array<{
      id: string;
      status: string;
      side: "in" | "out";
      from_user_id: string;
      to_user_id: string;
      player?: PlayersSearchRow;
    }> = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const row of page.requests ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        const side = row.side === "in" || row.side === "out" ? row.side : "out";
        out.push({ ...row, side });
      }
    }
    return out;
  }, [friendRequestsListQuery.data?.pages]);

  const dmRows = useMemo(() => {
    const pages = dmRequestsListQuery.data?.pages ?? [];
    const out: DMRequestRow[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const row of page.requests ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [dmRequestsListQuery.data?.pages]);

  /** Typeahead source: full membership/badge sets (not only the current list page). */
  const typeaheadLocal = useMemo((): PlayerSearchSuggestion[] | null => {
    const toSug = (row: PlayersSearchRow | undefined): PlayerSearchSuggestion | null => {
      if (!row?.id || !(row.username || "").trim()) return null;
      return {
        id: row.id,
        username: row.username,
        rating: row.rating ?? 0,
        country_code: row.country_code,
        avatar_thumb_url: row.avatar_thumb_url,
        online: row.online,
        playing: row.playing,
        host_trust_badge: row.host_trust_badge ?? null,
        host_trust_tier: row.host_trust_tier ?? null,
      };
    };
    if (sub === "all") return null;
    if (sub === "friends") {
      const out: PlayerSearchSuggestion[] = [];
      const seen = new Set<string>();
      for (const row of friendsQuery.data ?? []) {
        const s = toSug(row);
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        out.push(s);
      }
      return out;
    }
    if (sub === "requests") {
      const out: PlayerSearchSuggestion[] = [];
      const seen = new Set<string>();
      for (const row of [
        ...(requestsQuery.data?.incoming ?? []),
        ...(requestsQuery.data?.outgoing ?? []),
      ]) {
        const s = toSug(row.player);
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        out.push(s);
      }
      return out;
    }
    const out: PlayerSearchSuggestion[] = [];
    const seen = new Set<string>();
    for (const row of [
      ...(dmRequestsQuery.data?.incoming ?? []),
      ...(dmRequestsQuery.data?.outgoing ?? []),
    ]) {
      const s = toSug(row.player);
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
    return out;
  }, [
    sub,
    friendsQuery.data,
    requestsQuery.data?.incoming,
    requestsQuery.data?.outgoing,
    dmRequestsQuery.data?.incoming,
    dmRequestsQuery.data?.outgoing,
  ]);

  const activeListInfinite =
    sub === "friends"
      ? friendsListQuery
      : sub === "requests"
        ? friendRequestsListQuery
        : sub === "dms"
          ? dmRequestsListQuery
          : playersQuery;
  const fetchNextList = useCallback(() => {
    void activeListInfinite.fetchNextPage();
  }, [activeListInfinite.fetchNextPage]);

  useInfinitePanelScroll({
    enabled:
      active &&
      (sub === "all" || sub === "friends" || sub === "requests" || sub === "dms") &&
      pageSize > 0 &&
      !activeListInfinite.isPending &&
      !activeListInfinite.isError &&
      !openThread &&
      (sub === "all" || signedIn),
    scrollRef: listScrollRef,
    sentinelRef: listSentinelRef,
    hasNextPage: Boolean(activeListInfinite.hasNextPage),
    isFetchingNextPage: activeListInfinite.isFetchingNextPage,
    fetchNextPage: fetchNextList,
    // Identity only - never item count (count recreates IO and cascades pages).
    layoutKey: `${sub}:${debouncedQ}`,
  });

  const friendsMembershipReady = !signedIn || friendsQuery.isSuccess;
  const loading =
    sub === "friends"
      ? friendsListQuery.isPending || pageSize <= 0
      : sub === "requests"
        ? friendRequestsListQuery.isPending || pageSize <= 0
        : sub === "dms"
          ? dmRequestsListQuery.isPending || pageSize <= 0
          : playersQuery.isPending || pageSize <= 0 || (signedIn && friendsQuery.isLoading);
  const showFriendActions = friendsMembershipReady;

  // Fail-closed membership: never invent Add Friend when GET /friends failed.
  // Only toast hard first-load failure - refetch Network Error blips keep cache
  // (same pattern as DMThreadPanel isLoadingError).
  // biome-ignore lint/correctness/useExhaustiveDependencies: toast on isLoadingError edge only
  useEffect(() => {
    if (!signedIn || !shouldToastFriendsMembershipFailure(friendsQuery)) return;
    const msg = (chrome.toast_friend_failed || "").trim();
    if (msg) toast.error(msg);
  }, [signedIn, friendsQuery.isLoadingError, chrome.toast_friend_failed]);

  const pendingIncomingCount = useMemo(() => {
    if (!signedIn) return 0;
    return (requestsQuery.data?.incoming ?? []).filter((r) => r.status === "pending").length;
  }, [requestsQuery.data?.incoming, signedIn]);

  const pendingDmCount = useMemo(() => {
    if (!signedIn) return 0;
    return dmRequestsQuery.data?.pendingIncoming ?? 0;
  }, [dmRequestsQuery.data?.pendingIncoming, signedIn]);

  /** Prefer message unread (Telegram); fall back to pending requests. */
  const dmTabBadgeCount = useMemo(() => {
    if (!signedIn) return 0;
    const unread = dmRequestsQuery.data?.unreadTotal ?? 0;
    if (unread > 0) return unread;
    return pendingDmCount;
  }, [dmRequestsQuery.data?.unreadTotal, pendingDmCount, signedIn]);

  const requestsTabAria = useMemo(() => {
    const fmt = (chrome.friend_requests_count_aria || "").trim();
    if (pendingIncomingCount <= 0 || !fmt.includes("{count}")) {
      return chrome.sub_friend_requests;
    }
    return fmt.replaceAll("{count}", String(pendingIncomingCount));
  }, [chrome.friend_requests_count_aria, chrome.sub_friend_requests, pendingIncomingCount]);

  const dmsTabAria = useMemo(() => {
    const unread = dmRequestsQuery.data?.unreadTotal ?? 0;
    if (unread > 0) {
      const fmt = (chrome.dms_unread_count_aria || "").trim();
      if (fmt.includes("{count}")) return fmt.replaceAll("{count}", String(unread));
    }
    const fmt = (chrome.dms_requests_count_aria || "").trim();
    if (pendingDmCount <= 0 || !fmt.includes("{count}")) {
      return chrome.sub_dms;
    }
    return fmt.replaceAll("{count}", String(pendingDmCount));
  }, [
    chrome.dms_requests_count_aria,
    chrome.dms_unread_count_aria,
    chrome.sub_dms,
    dmRequestsQuery.data?.unreadTotal,
    pendingDmCount,
  ]);

  if (openThread && sub === "dms") {
    return (
      <DMThreadPanel
        chrome={chrome}
        threadId={openThread.threadId}
        peerName={openThread.peerName}
        canCompose={openThread.canCompose}
        pending={
          openThread.requestId && openThread.side && openThread.status
            ? {
                requestId: openThread.requestId,
                side: openThread.side,
                status: openThread.status,
              }
            : null
        }
        onBack={() => {
          setOpenThread(null);
          void dmRequestsQuery.refetch();
          void dmRequestsListQuery.refetch();
        }}
        onPendingResolved={({ canCompose, status }) => {
          setOpenThread((prev) =>
            prev
              ? {
                  ...prev,
                  canCompose,
                  status,
                }
              : null,
          );
          void dmRequestsQuery.refetch();
          void dmRequestsListQuery.refetch();
        }}
        onComposeStarted={(draft) => {
          setOpenThread(null);
          setSub("dms");
          setComposeOpening({
            peerName: draft.peerName,
            clientId: draft.clientId,
            toUserId: draft.toUserId,
            body: draft.body,
            imageUrl: draft.imageUrl,
            localStatus: "pending",
          });
        }}
        onComposeFailed={({ clientId }) => {
          setComposeOpening((prev) =>
            prev && prev.clientId === clientId ? { ...prev, localStatus: "failed" } : prev,
          );
        }}
        onOpenThread={(next) => {
          setComposeOpening(null);
          setSub("dms");
          setOpenThread(next);
        }}
      />
    );
  }

  if (composeOpening && sub === "dms") {
    const threadChrome = chatThreadChromeFrom(chrome);
    const me = useAuthStore.getState().user;
    return (
      <div className={playRailPanelClass}>
        <div className={cn(playRailStickySubClass, "flex shrink-0 items-center gap-2 px-3 py-2")}>
          <p className="truncate text-sm font-semibold text-[var(--dama-text)]">
            {composeOpening.peerName}
          </p>
        </div>
        {threadChrome && me?.id ? (
          <ul className="flex min-h-0 flex-1 flex-col justify-end gap-0 overflow-y-auto py-2">
            <ChatBubble
              msg={{
                id: composeOpening.clientId,
                user_id: me.id,
                username: me.username || "",
                avatar_thumb_url: me.avatarThumbUrl ?? null,
                body: composeOpening.body ?? null,
                image_url: composeOpening.imageUrl ?? null,
                receipt: composeOpening.localStatus === "failed" ? "failed" : "pending",
                local_status: composeOpening.localStatus === "failed" ? "failed" : "pending",
                created_at: new Date().toISOString(),
              }}
              mine
              nameMaxChars={chrome.live_player_name_max_chars}
              nameTruncateSuffix={chrome.name_truncate_suffix}
              replyActionLabel={chrome.dm_reply_action}
              formatName={formatPlayerNameDisplay}
              chrome={threadChrome}
              showReceipt
              onRetryFailed={
                composeOpening.localStatus === "failed" && composeOpening.toUserId && userId
                  ? () => {
                      const uid = userId.trim();
                      const toUserId = (composeOpening.toUserId || "").trim();
                      if (!uid || !toUserId) return;
                      updateChatOutboxItem(uid, composeOpening.clientId, { status: "pending" });
                      setComposeOpening({ ...composeOpening, localStatus: "pending" });
                      sendDm.mutate(
                        {
                          clientId: composeOpening.clientId,
                          to_user_id: toUserId,
                          body: composeOpening.body || undefined,
                          image_url: composeOpening.imageUrl || undefined,
                        },
                        {
                          onSuccess: (data) => {
                            dropChatOutboxMatchingServer(uid, [
                              { client_id: composeOpening.clientId },
                            ]);
                            const tid = (data.thread_id || data.message?.thread_id || "").trim();
                            if (!tid) {
                              updateChatOutboxItem(uid, composeOpening.clientId, {
                                status: "failed",
                              });
                              setComposeOpening({ ...composeOpening, localStatus: "failed" });
                              toast.error(chrome.dm_toast_failed);
                              return;
                            }
                            const reqStatus = (data.request?.status || "").trim();
                            const reqId = (data.request?.id || "").trim();
                            setComposeOpening(null);
                            setOpenThread({
                              threadId: tid,
                              peerName: composeOpening.peerName,
                              canCompose: !data.request || reqStatus === "accepted",
                              requestId: reqId || undefined,
                              side: data.request ? "out" : undefined,
                              status: reqStatus || undefined,
                            });
                          },
                          onError: () => {
                            updateChatOutboxItem(uid, composeOpening.clientId, {
                              status: "failed",
                            });
                            setComposeOpening({ ...composeOpening, localStatus: "failed" });
                            toast.error(chrome.dm_toast_failed);
                          },
                        },
                      );
                    }
                  : undefined
              }
            />
          </ul>
        ) : (
          <p className="p-4 text-center text-sm text-[var(--dama-muted)]">
            {chrome.dm_chat_loading}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={playRailPanelClass}>
      <PlayerProfileModal
        open={Boolean(profilePlayer)}
        onOpenChange={(v) => {
          if (!v) setProfilePlayer(null);
        }}
        player={profilePlayer}
        onChallenge={(pl) => {
          setProfilePlayer(null);
          onChallenge(pl as RailPlayer);
        }}
      />
      <ComposeMessageModal
        chrome={chrome}
        open={Boolean(messageTarget)}
        onOpenChange={(v) => {
          if (!v) setMessageTarget(null);
        }}
        target={messageTarget}
        onComposeStarted={(draft) => {
          setMessageTarget(null);
          setSub("dms");
          setComposeOpening({
            peerName: draft.peerName,
            clientId: draft.clientId,
            toUserId: draft.toUserId,
            body: draft.body,
            imageUrl: draft.imageUrl,
            localStatus: "pending",
          });
        }}
        onComposeFailed={({ clientId }) => {
          setComposeOpening((prev) =>
            prev && prev.clientId === clientId ? { ...prev, localStatus: "failed" } : prev,
          );
        }}
        onOpenedThread={({ threadId, peerName, canCompose, requestId, side, status }) => {
          setComposeOpening(null);
          setMessageTarget(null);
          setSub("dms");
          setOpenThread({
            threadId,
            peerName,
            canCompose,
            requestId,
            side,
            status,
          });
        }}
      />
      <div className={cn(playRailStickySubClass, "border-b-0")}>
        <div
          className="grid grid-cols-4 border-b border-[var(--dama-border)]"
          role="tablist"
          aria-label={chrome.tab_players}
        >
          {(
            [
              { id: "friends" as const, label: chrome.sub_friends },
              { id: "requests" as const, label: chrome.sub_friend_requests },
              { id: "dms" as const, label: chrome.sub_dms },
              { id: "all" as const, label: chrome.sub_all_players },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sub === t.id}
              aria-label={
                t.id === "requests" ? requestsTabAria : t.id === "dms" ? dmsTabAria : t.label
              }
              className={cn(
                "relative px-0.5 py-2.5 text-[10px] font-semibold sm:px-1.5 sm:text-xs",
                sub === t.id
                  ? "border-b-2 border-[var(--dama-text)] text-[var(--dama-text)]"
                  : "border-b-2 border-transparent text-[var(--dama-muted-foreground)] hover:text-[var(--dama-text)]",
              )}
              onClick={() => {
                setSub(t.id);
                if (t.id !== "dms") setOpenThread(null);
              }}
            >
              <span className="inline-flex items-center justify-center gap-1">
                {t.label}
                {t.id === "requests" && pendingIncomingCount > 0 ? (
                  <span
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--dama-panel)] bg-[var(--dama-text)] px-1 text-[10px] font-semibold tabular-nums text-[var(--dama-bg)]"
                    aria-hidden
                  >
                    {pendingIncomingCount}
                  </span>
                ) : null}
                {t.id === "dms" && dmTabBadgeCount > 0 ? (
                  <span
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--dama-panel)] bg-[var(--dama-brand)] px-1 text-[10px] font-semibold tabular-nums text-white"
                    aria-hidden
                  >
                    {formatDmUnreadBadge(
                      dmTabBadgeCount,
                      chrome.dm_unread_badge_max,
                      chrome.dm_unread_badge_overflow_fmt,
                    )}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--dama-border)] px-3 py-2">
          <PlayerSearchTypeahead
            chrome={chrome}
            value={q}
            onValueChange={setQ}
            placeholder={chrome.search_username_placeholder}
            enabled={sub === "all" ? true : signedIn}
            serverSearch={sub === "all"}
            localSuggestions={typeaheadLocal}
            onSelect={(p) => {
              setQ(p.username);
              if (sub === "dms") {
                // Prefer unpaged membership (typeahead source), then paged list.
                const membership = [
                  ...(dmRequestsQuery.data?.incoming ?? []),
                  ...(dmRequestsQuery.data?.outgoing ?? []),
                ];
                const row =
                  membership.find((r) => r.player?.id === p.id) ??
                  dmRows.find((r) => r.player?.id === p.id);
                if (row?.thread_id) {
                  setOpenThread({
                    threadId: row.thread_id,
                    peerName: p.username,
                    canCompose: row.status === "accepted",
                    requestId: row.id,
                    side: row.side,
                    status: row.status,
                  });
                  return;
                }
              }
              // Friends / requests / all players: open profile on the first pick.
              setProfilePlayer(
                mapRow({
                  id: p.id,
                  username: p.username,
                  rating: p.rating,
                  xp: 0,
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
          {sub === "friends" && !signedIn ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.sign_in_friends}</p>
          ) : (sub === "requests" || sub === "dms") && !signedIn ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.sign_in_friends}</p>
          ) : loading ? (
            <PlayRailListSkeleton variant="player" rows={8} />
          ) : sub === "dms" ? (
            dmRows.length === 0 ? (
              <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.dm_empty_requests}</p>
            ) : (
              <ul>
                {dmRows.map((row) => {
                  const peer = row.player;
                  if (!peer?.id || !peer.username) return null;
                  const player = mapRow(peer);
                  const busyId =
                    acceptDm.isPending || denyDm.isPending || cancelDm.isPending
                      ? (acceptDm.variables ?? denyDm.variables ?? cancelDm.variables)
                      : null;
                  const rowBusy = busyId === row.id;
                  const statusLabel =
                    row.status === "denied"
                      ? chrome.dm_request_denied_label
                      : row.status === "cancelled"
                        ? chrome.dm_request_cancelled_label
                        : row.status === "pending" && row.side === "in"
                          ? chrome.dm_request_pending_label
                          : row.status === "pending" && row.side === "out"
                            ? chrome.dm_request_outgoing_label
                            : "";
                  const unread = typeof row.unread_count === "number" ? row.unread_count : 0;
                  const unreadLabel = formatDmUnreadBadge(
                    unread,
                    chrome.dm_unread_badge_max,
                    chrome.dm_unread_badge_overflow_fmt,
                  );
                  const unreadAria =
                    unread > 0 && (chrome.dms_unread_count_aria || "").includes("{count}")
                      ? chrome.dms_unread_count_aria.replaceAll("{count}", String(unread))
                      : unreadLabel;
                  const openDmThread = () => {
                    if (!row.thread_id) return;
                    setOpenThread({
                      threadId: row.thread_id,
                      peerName: player.username,
                      canCompose: row.status === "accepted",
                      requestId: row.id,
                      side: row.side,
                      status: row.status,
                    });
                  };
                  const canOpen = Boolean(row.thread_id);
                  const openLabel = `${chrome.message_action} ${player.username}`.trim();
                  return (
                    <li key={row.id}>
                      {/*
                        Messaging-list pattern (Telegram/WhatsApp/iMessage):
                        the whole row is one primary hit target → open thread.
                        Only Accept/Deny/Cancel are nested actions (stopPropagation).
                        Avatar/name keep hover peek; they must NOT stopPropagation.
                      */}
                      <div
                        role={canOpen ? "button" : undefined}
                        tabIndex={canOpen ? 0 : undefined}
                        aria-label={canOpen ? openLabel : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5 transition-colors hover:bg-[var(--dama-hover)]",
                          canOpen ? "cursor-pointer" : undefined,
                        )}
                        onMouseDown={(e) => {
                          // Keep first press after search debounce from being eaten by input blur.
                          if (canOpen) e.preventDefault();
                        }}
                        onClick={() => {
                          if (canOpen) openDmThread();
                        }}
                        onKeyDown={(e) => {
                          if (!canOpen) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDmThread();
                          }
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <PlayerHoverCard
                              chrome={chrome}
                              player={player}
                              signedIn={signedIn}
                              openOnClick={false}
                              onChallenge={onChallenge}
                              onWatch={onWatch}
                              onMessage={(p) =>
                                setMessageTarget({
                                  id: p.id,
                                  username: p.username,
                                  avatarThumbUrl: p.avatarThumbUrl,
                                  avatarFullUrl: p.avatarFullUrl,
                                })
                              }
                            >
                              {/* span (not button): avoid nested interactive; row owns the click */}
                              <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-left">
                                <span className="relative h-8 w-8 shrink-0 overflow-visible rounded-md">
                                  <DamaUserAvatar
                                    src={player.avatarThumbUrl || player.avatarFullUrl}
                                    className="h-8 w-8 rounded-md"
                                  />
                                  <OnlineStatusDot
                                    online={player.online}
                                    playing={player.playing}
                                  />
                                </span>
                                <span
                                  className={cn(
                                    "min-w-0 truncate text-sm",
                                    unread > 0
                                      ? "font-bold text-[var(--dama-text)]"
                                      : "font-semibold text-[var(--dama-text)]",
                                  )}
                                >
                                  {formatPlayerNameDisplay(
                                    player.username,
                                    chrome.live_player_name_max_chars,
                                    chrome.name_truncate_suffix,
                                  )}
                                </span>
                              </span>
                            </PlayerHoverCard>
                            <CountryFlag code={player.countryCode} />
                          </span>
                          {(player.hostTrustBadge || "").trim() ? (
                            <HostTrustBadge
                              label={player.hostTrustBadge}
                              tier={player.hostTrustTier}
                              className="mt-0.5 text-[9px]"
                            />
                          ) : null}
                          <span
                            className={cn(
                              "block truncate text-xs",
                              unread > 0
                                ? "font-semibold text-[var(--dama-text)]"
                                : "text-[var(--dama-muted)]",
                            )}
                          >
                            {row.preview}
                          </span>
                          {statusLabel ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
                              {statusLabel}
                            </span>
                          ) : null}
                        </div>
                        {unreadLabel ? (
                          <span
                            className="pointer-events-none inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--dama-brand)] px-1.5 text-[11px] font-bold tabular-nums text-white"
                            aria-label={unreadAria}
                            title={unreadAria}
                          >
                            {unreadLabel}
                          </span>
                        ) : null}
                        {row.side === "in" && row.status === "pending" ? (
                          <div
                            className="relative z-[1] flex shrink-0 gap-1"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="play"
                              size="sm"
                              className="h-8 text-xs"
                              isLoading={rowBusy && acceptDm.isPending}
                              pendingLabel={chrome.dm_accepting}
                              disabled={rowBusy}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await acceptDm.mutateAsync(row.id);
                                    toast.success(chrome.dm_toast_accepted);
                                    if (row.thread_id) {
                                      setOpenThread({
                                        threadId: row.thread_id,
                                        peerName: player.username,
                                        canCompose: true,
                                        requestId: row.id,
                                        side: row.side,
                                        status: "accepted",
                                      });
                                    }
                                  } catch {
                                    toast.error(chrome.dm_toast_failed);
                                  }
                                })();
                              }}
                            >
                              {chrome.dm_accept_action}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              isLoading={rowBusy && denyDm.isPending}
                              pendingLabel={chrome.dm_denying}
                              disabled={rowBusy}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await denyDm.mutateAsync(row.id);
                                    toast.success(chrome.dm_toast_denied);
                                  } catch {
                                    toast.error(chrome.dm_toast_failed);
                                  }
                                })();
                              }}
                            >
                              {chrome.dm_deny_action}
                            </Button>
                          </div>
                        ) : null}
                        {row.side === "out" && row.status === "pending" ? (
                          <div
                            className="relative z-[1] shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              isLoading={rowBusy && cancelDm.isPending}
                              pendingLabel={chrome.dm_cancelling}
                              disabled={rowBusy}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await cancelDm.mutateAsync(row.id);
                                    toast.success(chrome.dm_toast_cancelled);
                                  } catch {
                                    toast.error(chrome.dm_toast_failed);
                                  }
                                })();
                              }}
                            >
                              {chrome.dm_cancel_action}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : sub === "requests" ? (
            requestRows.length === 0 ? (
              <p className="p-4 text-sm text-[var(--dama-muted)]">{chrome.empty_friend_requests}</p>
            ) : (
              <ul>
                {requestRows.map((row) => {
                  const peer = row.player;
                  if (!peer?.id || !peer.username) return null;
                  const player = mapRow(peer);
                  const busyId =
                    acceptReq.isPending || denyReq.isPending || cancelReq.isPending
                      ? (acceptReq.variables ?? denyReq.variables ?? cancelReq.variables)
                      : null;
                  const rowBusy = busyId === row.id;
                  const statusLabel =
                    row.status === "denied"
                      ? chrome.friend_request_denied_label
                      : row.side === "in"
                        ? chrome.friend_request_pending_label
                        : chrome.friend_request_outgoing_label;
                  const profileHref = playerProfileHref(player.id);
                  const viewLabel = (chrome.view_profile_action || "").trim();
                  return (
                    <li key={row.id}>
                      <div className="flex w-full items-center gap-2 border-b border-[var(--dama-border)]/60 px-3 py-2.5 transition-colors hover:bg-[var(--dama-hover)]">
                        {/* One HoverCard for avatar+name (not the whole row). */}
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <PlayerHoverCard
                              chrome={chrome}
                              player={player}
                              signedIn={signedIn}
                              openOnClick={false}
                              onMessage={(p) =>
                                setMessageTarget({
                                  id: p.id,
                                  username: p.username,
                                  avatarThumbUrl: p.avatarThumbUrl,
                                  avatarFullUrl: p.avatarFullUrl,
                                })
                              }
                              requestActions={{
                                side: row.side,
                                status: row.status,
                                requestBusy: rowBusy,
                                acceptBusy: rowBusy && acceptReq.isPending,
                                denyBusy: rowBusy && denyReq.isPending,
                                cancelBusy: rowBusy && cancelReq.isPending,
                                onAccept: () => {
                                  void (async () => {
                                    try {
                                      await acceptReq.mutateAsync(row.id);
                                      toast.success(chrome.toast_friend_request_accepted);
                                    } catch {
                                      toast.error(chrome.toast_friend_request_failed);
                                    }
                                  })();
                                },
                                onDeny: () => {
                                  void (async () => {
                                    try {
                                      await denyReq.mutateAsync(row.id);
                                      toast.success(chrome.toast_friend_request_denied);
                                    } catch {
                                      toast.error(chrome.toast_friend_request_failed);
                                    }
                                  })();
                                },
                                onCancel: () => {
                                  void (async () => {
                                    try {
                                      await cancelReq.mutateAsync(row.id);
                                      toast.success(chrome.toast_friend_request_cancelled);
                                    } catch {
                                      toast.error(chrome.toast_friend_request_failed);
                                    }
                                  })();
                                },
                              }}
                            >
                              <button
                                type="button"
                                className="inline-flex min-w-0 max-w-full items-center gap-2 text-left"
                                aria-label={player.username}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setProfilePlayer(player)}
                              >
                                <span className="relative h-8 w-8 shrink-0 overflow-visible rounded-md">
                                  <DamaUserAvatar
                                    src={player.avatarThumbUrl || player.avatarFullUrl}
                                    className="h-8 w-8 rounded-md"
                                  />
                                  <OnlineStatusDot
                                    online={player.online}
                                    playing={player.playing}
                                  />
                                </span>
                                <span className="min-w-0 truncate text-sm font-semibold text-[var(--dama-text)] hover:underline">
                                  {formatPlayerNameDisplay(
                                    player.username,
                                    chrome.live_player_name_max_chars,
                                    chrome.name_truncate_suffix,
                                  )}
                                </span>
                              </button>
                            </PlayerHoverCard>
                            <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                              {chrome.rating_paren_open}
                              {player.rating}
                              {chrome.rating_paren_close}
                            </span>
                            <CountryFlag code={player.countryCode} />
                          </span>
                          {(player.hostTrustBadge || "").trim() ? (
                            <HostTrustBadge
                              label={player.hostTrustBadge}
                              tier={player.hostTrustTier}
                              className="mt-0.5 text-[9px]"
                            />
                          ) : null}
                          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dama-muted)]">
                            {statusLabel}
                          </span>
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
                        {row.side === "in" && row.status === "pending" ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="play"
                              size="sm"
                              className="h-8 text-xs"
                              isLoading={rowBusy && acceptReq.isPending}
                              pendingLabel={chrome.accepting_friend_request}
                              disabled={rowBusy}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void (async () => {
                                  try {
                                    await acceptReq.mutateAsync(row.id);
                                    toast.success(chrome.toast_friend_request_accepted);
                                  } catch {
                                    toast.error(chrome.toast_friend_request_failed);
                                  }
                                })();
                              }}
                            >
                              {chrome.accept_friend_request_action}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              isLoading={rowBusy && denyReq.isPending}
                              pendingLabel={chrome.denying_friend_request}
                              disabled={rowBusy}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void (async () => {
                                  try {
                                    await denyReq.mutateAsync(row.id);
                                    toast.success(chrome.toast_friend_request_denied);
                                  } catch {
                                    toast.error(chrome.toast_friend_request_failed);
                                  }
                                })();
                              }}
                            >
                              {chrome.deny_friend_request_action}
                            </Button>
                          </div>
                        ) : null}
                        {row.side === "out" && row.status === "pending" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            isLoading={rowBusy && cancelReq.isPending}
                            pendingLabel={chrome.cancelling_friend_request}
                            disabled={rowBusy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void (async () => {
                                try {
                                  await cancelReq.mutateAsync(row.id);
                                  toast.success(chrome.toast_friend_request_cancelled);
                                } catch {
                                  toast.error(chrome.toast_friend_request_failed);
                                }
                              })();
                            }}
                          >
                            {chrome.cancel_friend_request_action}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : players.length === 0 ? (
            <p className="p-4 text-sm text-[var(--dama-muted)]">
              {sub === "friends" ? chrome.empty_friends : chrome.empty_players}
            </p>
          ) : (
            <ul>
              {players.map((p) => {
                const outgoingPending = outgoingPendingIds.has(p.id);
                return (
                  <li key={p.id}>
                    <PlayerListRow
                      chrome={chrome}
                      player={p}
                      signedIn={signedIn}
                      onChallenge={onChallenge}
                      onWatch={onWatch}
                      onActivate={(pl) => setProfilePlayer(pl)}
                      onMessage={(pl) =>
                        setMessageTarget({
                          id: pl.id,
                          username: pl.username,
                          avatarThumbUrl: pl.avatarThumbUrl,
                          avatarFullUrl: pl.avatarFullUrl,
                        })
                      }
                      challengeBusy={challengeBusy}
                      friendBusy={addFriend.isPending || removeFriend.isPending}
                      addFriendBusy={addFriend.isPending && addFriend.variables === p.id}
                      removeFriendBusy={removeFriend.isPending && removeFriend.variables === p.id}
                      requestPendingOutgoing={outgoingPending}
                      isFriend={
                        showFriendActions ? sub === "friends" || friendIds.has(p.id) : undefined
                      }
                      onAddFriend={
                        showFriendActions && sub === "all" && !outgoingPending
                          ? (pl) => {
                              void (async () => {
                                try {
                                  await addFriend.mutateAsync(pl.id);
                                  toast.success(chrome.toast_friend_request_sent);
                                } catch (e) {
                                  const msg =
                                    e && typeof e === "object" && "response" in e
                                      ? String(
                                          (e as { response?: { data?: { error?: string } } })
                                            .response?.data?.error ?? "",
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
                        showFriendActions
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
                );
              })}
            </ul>
          )}
          {sub === "all" || sub === "friends" || sub === "requests" || sub === "dms" ? (
            <InfiniteListEnd
              sentinelRef={listSentinelRef}
              loading={activeListInfinite.isFetchingNextPage}
              loadingLabel={chrome.loading_more}
            />
          ) : (
            <div ref={listSentinelRef} className="h-px w-full shrink-0" aria-hidden />
          )}
        </div>
      </PlayRailScrollPort>
    </div>
  );
}
