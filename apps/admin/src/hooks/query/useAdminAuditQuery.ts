import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AuditRow } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminAuditListResponse = {
  audit: AuditRow[];
  meta: SkipPaginationMeta;
};

export function adminAuditQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
) {
  return ["admin-audit", token, skip, limit, q.trim()] as const;
}

export function useAdminAuditQuery(
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
    queryKey: adminAuditQueryKey(token, skip, limit, needle),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminAuditListResponse> => {
      const { data } = await restClient.get<AdminAuditListResponse>("/console/audit", {
        headers: { Authorization: `Bearer ${token}` },
        params: { skip, limit, ...(needle ? { q: needle } : {}) },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
