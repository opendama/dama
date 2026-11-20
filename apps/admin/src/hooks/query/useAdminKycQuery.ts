import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ConsoleKycSubmission } from "@/types/console";
import { useQuery } from "@tanstack/react-query";

export type AdminKycListResponse = {
  submissions: ConsoleKycSubmission[];
  status?: string;
  meta: SkipPaginationMeta;
};

export function adminKycQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  status: string,
  q = "",
) {
  return ["admin-kyc", token, skip, limit, status, q] as const;
}

export function useAdminKycQuery(
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
    queryKey: adminKycQueryKey(token, skip, limit, statusFilter, query),
    enabled: hydrated && Boolean(token) && enabled && limit > 0 && Boolean(statusFilter),
    queryFn: async (): Promise<AdminKycListResponse> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminKycListResponse>("/kyc/documents/console", {
        headers: authHeaders(token),
        params: {
          skip,
          limit,
          status: statusFilter,
          ...(query ? { q: query } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
