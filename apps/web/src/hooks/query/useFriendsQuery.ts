import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import type { PlayersSearchRow } from "@/hooks/query/usePlayersSearchQuery";
import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type FriendRequestRow = {
  id: string;
  status: string;
  from_user_id: string;
  to_user_id: string;
  /** Present on Trim-paged `/friends/requests?skip&limit` rows. */
  side?: "in" | "out";
  player?: PlayersSearchRow;
};

export type FriendsMembershipQueryOptions = {
  /**
   * Background poll for membership Sets / badges.
   * Disable while a DM thread (or other surface) only needs cached CTAs -
   * mutations already invalidate `["friends"]`.
   */
  poll?: boolean;
};

/** Full friends list (no skip/limit) for membership Sets / Add Friend CTAs. */
export function useFriendsQuery(
  token: string | null | undefined,
  opts?: FriendsMembershipQueryOptions,
) {
  const poll = opts?.poll !== false;
  return useQuery({
    queryKey: ["friends", token ?? ""] as const,
    enabled: Boolean(token),
    staleTime: QueryStale.live,
    refetchInterval: poll ? 20_000 : false,
    queryFn: async ({ signal }) => {
      const { data } = await restClient.get<{ friends?: PlayersSearchRow[] }>("/friends/", {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.friends ?? [];
    },
  });
}

export function friendsInfiniteQueryKey(token: string | null | undefined, limit: number, q = "") {
  return ["friends", "infinite", token ?? "", limit, q.trim()] as const;
}

/** Trim-bell infinite scroll for the Friends rail tab. Optional q is server-side username search. */
export function useFriendsInfinite(
  token: string | null | undefined,
  limit: number,
  enabled = true,
  q = "",
) {
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: friendsInfiniteQueryKey(token, pageSize, needle),
    enabled: Boolean(token) && pageSize > 0 && enabled,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite lists - refetching every page reshuffles/glitches scroll.
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await restClient.get<{
        friends?: PlayersSearchRow[];
        meta?: SkipPaginationMeta;
      }>("/friends/", {
        signal,
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        friends: data.friends ?? [],
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.friends?.length ?? 0),
  });
}

export function useFriendRequestsQuery(
  token: string | null | undefined,
  opts?: FriendsMembershipQueryOptions,
) {
  const poll = opts?.poll !== false;
  return useQuery({
    queryKey: ["friends", "requests", token ?? ""] as const,
    enabled: Boolean(token),
    staleTime: QueryStale.live,
    refetchInterval: poll ? 15_000 : false,
    placeholderData: () => undefined,
    queryFn: async ({ signal }) => {
      const { data } = await restClient.get<{
        incoming?: FriendRequestRow[];
        outgoing?: FriendRequestRow[];
      }>("/friends/requests", {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
      };
    },
  });
}

export type FriendRequestListRow = FriendRequestRow & { side: "in" | "out" };

/** Trim-bell infinite scroll for the Friend Requests rail tab. Optional q is server-side peer username search. */
export function useFriendRequestsInfinite(
  token: string | null | undefined,
  limit: number,
  enabled = true,
  q = "",
) {
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: ["friends", "requests", "infinite", token ?? "", pageSize, needle] as const,
    enabled: Boolean(token) && pageSize > 0 && enabled,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite lists - refetching every page reshuffles/glitches scroll.
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await restClient.get<{
        requests?: FriendRequestListRow[];
        meta?: SkipPaginationMeta;
      }>("/friends/requests", {
        signal,
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        requests: Array.isArray(data.requests) ? data.requests : [],
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.requests?.length ?? 0),
  });
}

function invalidateFriendQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["friends"] });
}

/** Sends a pending friend request (POST /friends/{id}). */
export function useAddFriendMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/friends/${friendId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useAcceptFriendRequestMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/friends/requests/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useDenyFriendRequestMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.post(
        `/friends/requests/${requestId}/deny`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useCancelFriendRequestMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!token) throw new Error("");
      await restClient.delete(`/friends/requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => invalidateFriendQueries(qc),
  });
}

export function useRemoveFriendMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      if (!token) throw new Error("");
      await restClient.delete(`/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => invalidateFriendQueries(qc),
  });
}
