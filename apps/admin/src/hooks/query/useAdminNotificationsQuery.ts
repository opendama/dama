import { restClient } from "@/lib/api";
import type { NotificationsListResponse, NotificationsUnreadResponse } from "@/types/notifications";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

/** Fail-closed next skip (empty page / no has_more → stop). */
function nextSkipFromMeta(
  meta: { has_more?: boolean; next_skip?: number | null } | null | undefined,
  pageRowCount: number,
): number | undefined {
  if (!meta?.has_more) return undefined;
  if (pageRowCount <= 0) return undefined;
  const next = meta.next_skip;
  return typeof next === "number" && next >= 0 ? next : undefined;
}

export function adminNotificationsUnreadQueryKey(token: string | null | undefined) {
  return ["admin-notifications-unread", token] as const;
}

export function useAdminNotificationsUnread(token: string | null | undefined) {
  return useQuery({
    queryKey: adminNotificationsUnreadQueryKey(token),
    enabled: Boolean(token),
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await restClient.get<NotificationsUnreadResponse>(
        "/console/notifications/unread-count",
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

export function useAdminNotificationsInfinite(
  token: string | null | undefined,
  limit: number,
  enabled: boolean,
) {
  const pageSize = limit > 0 ? limit : 0;
  return useInfiniteQuery({
    queryKey: ["admin-notifications", "infinite", token, pageSize],
    enabled: Boolean(token) && pageSize > 0 && enabled,
    // Soft stale window - avoid remount refetch reshuffling the open list (scroll flicker).
    staleTime: 30_000,
    refetchOnMount: true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<NotificationsListResponse>("/console/notifications", {
        params: { skip: pageParam, limit: pageSize },
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.items?.length ?? 0),
  });
}
