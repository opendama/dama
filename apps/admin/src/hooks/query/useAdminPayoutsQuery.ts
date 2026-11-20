import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ConsolePayout } from "@/types/console";
import { useQuery } from "@tanstack/react-query";

export type AdminPayoutsListResponse = {
  payouts: ConsolePayout[];
  meta: SkipPaginationMeta;
};

export function adminPayoutsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  status = "",
  q = "",
) {
  return ["admin-payouts", token, skip, limit, status, q] as const;
}

export function useAdminPayoutsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  status = "",
  q = "",
) {
  const hydrated = useAuthHydrated();
  const query = q.trim();
  const statusFilter = status.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminPayoutsQueryKey(token, skip, limit, statusFilter, query),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminPayoutsListResponse> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminPayoutsListResponse>("/payouts/console", {
        headers: authHeaders(token),
        params: {
          skip,
          limit,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(query ? { q: query } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
