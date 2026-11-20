import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminBank } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminBanksListResponse = {
  banks: AdminBank[];
  meta: SkipPaginationMeta;
};

export type AdminBanksListFilters = {
  q?: string;
  status?: string;
};

export function adminBanksQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: AdminBanksListFilters = {},
) {
  return ["admin-banks", token, skip, limit, filters.q || "", filters.status || ""] as const;
}

export function useAdminBanksQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  filters: AdminBanksListFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminBanksQueryKey(token, skip, limit, { q, status }),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminBanksListResponse> => {
      const { data } = await restClient.get<AdminBanksListResponse>("/console/banks", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          skip,
          limit,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
