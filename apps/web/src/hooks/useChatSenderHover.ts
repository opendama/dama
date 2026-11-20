"use client";

import type { ChatSenderHoverActions } from "@/components/chat/ChatThreadUI";
import type { MessageTarget } from "@/components/chat/ComposeMessageModal";
import type { RailPlayer } from "@/components/play-rail/PlayerListRow";
import {
  useAddFriendMutation,
  useFriendRequestsQuery,
  useFriendsQuery,
  useRemoveFriendMutation,
} from "@/hooks/query/useFriendsQuery";
import { useAuthStore } from "@/store/auth";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Shared play-rail hover actions for chat sender avatars
 * (challenge / message / friend) - same flow as PlayersPanel rows.
 */
export function useChatSenderHover(chrome: PlayRailChromeReady, enabled: boolean) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const signedIn = Boolean(token) && enabled;
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);

  // Cache-only: hover CTAs must not keep a 20s/15s poll alive under open DMs
  // (Players/Games panels own membership polling; mutations invalidate).
  const friendsQuery = useFriendsQuery(signedIn ? token : null, { poll: false });
  const requestsQuery = useFriendRequestsQuery(signedIn ? token : null, { poll: false });
  const addFriend = useAddFriendMutation(token);
  const removeFriend = useRemoveFriendMutation(token);

  const friendsReady = friendsQuery.isSuccess;
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

  const openChallenge = useCallback(
    (player: RailPlayer) => {
      try {
        sessionStorage.setItem(
          "dama.create.opponent",
          JSON.stringify({
            id: player.id,
            username: player.username,
            rating: player.rating,
            countryCode: player.countryCode,
            avatarThumbUrl: player.avatarThumbUrl,
            online: player.online,
            playing: player.playing,
            hostTrustBadge: player.hostTrustBadge ?? null,
            hostTrustTier: player.hostTrustTier ?? null,
          }),
        );
      } catch {
        /* ignore */
      }
      router.push("/?rail=new&sub=challenge");
    },
    [router],
  );

  const hoverFor = useCallback(
    (userId: string): ChatSenderHoverActions | null => {
      const id = userId.trim();
      if (!id) return null;
      const isFriend = friendsReady ? friendIds.has(id) : undefined;
      const outgoingPending = outgoingPendingIds.has(id);
      return {
        chrome,
        signedIn,
        isFriend,
        requestPendingOutgoing: outgoingPending,
        onChallenge: openChallenge,
        onMessage: signedIn
          ? (pl) =>
              setMessageTarget({
                id: pl.id,
                username: pl.username,
                avatarThumbUrl: pl.avatarThumbUrl,
                avatarFullUrl: pl.avatarFullUrl,
              })
          : undefined,
        onAddFriend:
          friendsReady && !outgoingPending && isFriend === false
            ? (pl) => {
                void addFriend.mutateAsync(pl.id).then(
                  () => toast.success(chrome.toast_friend_request_sent),
                  () => toast.error(chrome.toast_friend_request_failed),
                );
              }
            : undefined,
        onRemoveFriend:
          friendsReady && isFriend === true
            ? (pl) => {
                void removeFriend.mutateAsync(pl.id).then(
                  () => toast.success(chrome.toast_friend_removed),
                  () => toast.error(chrome.toast_friend_failed),
                );
              }
            : undefined,
        addFriendBusy: addFriend.isPending && addFriend.variables === id,
        removeFriendBusy: removeFriend.isPending && removeFriend.variables === id,
        friendBusy: addFriend.isPending || removeFriend.isPending,
      };
    },
    [
      addFriend,
      chrome,
      friendIds,
      friendsReady,
      openChallenge,
      outgoingPendingIds,
      removeFriend,
      signedIn,
    ],
  );

  return { messageTarget, setMessageTarget, hoverFor, signedIn };
}
