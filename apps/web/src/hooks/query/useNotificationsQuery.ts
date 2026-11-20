import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import type { NotificationsListResponse, NotificationsUnreadResponse } from "@/types/notifications";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function notificationsUnreadQueryKey(token: string | null | undefined) {
  return ["notifications-unread", token] as const;
}

export function notificationsInfiniteQueryKey(token: string | null | undefined, limit: number) {
  return ["notifications", "infinite", token, limit] as const;
}

export function useNotificationsUnread(token: string | null | undefined) {
  return useQuery({
    queryKey: notificationsUnreadQueryKey(token),
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await restClient.get<NotificationsUnreadResponse>(
        "/me/notifications/unread-count",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    refetchInterval: (query) => {
      const ms = query.state.data?.chrome?.poll_interval_ms;
      return typeof ms === "number" && ms > 0 ? ms : false;
    },
  });
}

export function useNotificationsInfinite(
  token: string | null | undefined,
  limit: number,
  enabled: boolean,
) {
  const pageSize = limit > 0 ? limit : 0;
  return useInfiniteQuery({
    queryKey: notificationsInfiniteQueryKey(token, pageSize),
    enabled: Boolean(token) && pageSize > 0 && enabled,
    // Soft stale window - avoid remount refetch reshuffling the open list (scroll flicker).
    staleTime: 30_000,
    refetchOnMount: true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<NotificationsListResponse>("/me/notifications", {
        params: { skip: pageParam, limit: pageSize },
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.items?.length ?? 0),
  });
}
