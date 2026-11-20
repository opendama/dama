import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { Fingerprint } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminFingerprintsListResponse = {
  fingerprints: Fingerprint[];
  meta: SkipPaginationMeta;
};

export function adminFingerprintsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
) {
  return ["admin-fingerprints", token, skip, limit, q.trim()] as const;
}

export function useAdminFingerprintsQuery(
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
    queryKey: adminFingerprintsQueryKey(token, skip, limit, needle),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminFingerprintsListResponse> => {
      const { data } = await restClient.get<AdminFingerprintsListResponse>(
        "/console/fingerprints",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { skip, limit, ...(needle ? { q: needle } : {}) },
        },
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
