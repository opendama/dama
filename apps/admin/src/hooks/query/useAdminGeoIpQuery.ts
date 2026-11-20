import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { GeoRow } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminGeoIpListResponse = {
  geo_ip_records: GeoRow[];
  meta: SkipPaginationMeta;
};

export function adminGeoIpQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
) {
  return ["admin-geo-ip", token, skip, limit, q.trim()] as const;
}

export function useAdminGeoIpQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  q = "",
) {
  const hydrated = useAuthHydrated();
  const needle = q.trim();
  return useQuery({
    staleTime: QueryStale.live,
    queryKey: adminGeoIpQueryKey(token, skip, limit, needle),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminGeoIpListResponse> => {
      const { data } = await restClient.get<AdminGeoIpListResponse>("/console/geo-ip", {
        headers: { Authorization: `Bearer ${token}` },
        params: { skip, limit, ...(needle ? { q: needle } : {}) },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
