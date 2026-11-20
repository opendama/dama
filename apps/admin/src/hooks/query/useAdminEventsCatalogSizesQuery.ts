import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { EventsCatalogSize } from "@/types/events-catalog";
import { useQuery } from "@tanstack/react-query";

export type AdminEventsCatalogSizesListResponse = {
  sizes: EventsCatalogSize[];
  meta: SkipPaginationMeta;
};

export type AdminEventsCatalogSizesFilters = {
  q?: string;
  status?: string;
};

export function adminEventsCatalogSizesQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: AdminEventsCatalogSizesFilters = {},
) {
  return [
    "admin-events-catalog-sizes",
    token,
    skip,
    limit,
    filters.q || "",
    filters.status || "",
  ] as const;
}

export function useAdminEventsCatalogSizesQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  filters: AdminEventsCatalogSizesFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminEventsCatalogSizesQueryKey(token, skip, limit, { q, status }),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminEventsCatalogSizesListResponse> => {
      const { data } = await restClient.get<AdminEventsCatalogSizesListResponse>(
        "/console/events/catalog/sizes",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            skip,
            limit,
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
          },
        },
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
