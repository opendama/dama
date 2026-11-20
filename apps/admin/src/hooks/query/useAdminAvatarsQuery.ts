import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AvatarRow } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminAvatarsListResponse = {
  avatars: AvatarRow[];
  meta: SkipPaginationMeta;
};

export function adminAvatarsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
) {
  return ["admin-avatars", token, skip, limit, q] as const;
}

export function useAdminAvatarsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  q = "",
) {
  const hydrated = useAuthHydrated();
  const query = q.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminAvatarsQueryKey(token, skip, limit, query),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    refetchOnWindowFocus: true,
    /** Pending uploads land via DB + admin.avatar_pending; poll so the queue stays live. */
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await restClient.get<AdminAvatarsListResponse>("/console/avatars", {
        headers: { Authorization: `Bearer ${token}` },
        params: { skip, limit, ...(query ? { q: query } : {}) },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
