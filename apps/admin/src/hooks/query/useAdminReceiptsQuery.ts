import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdminReceipt } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type AdminReceiptsListResponse = {
  receipts: AdminReceipt[];
  meta: SkipPaginationMeta;
};

export function adminReceiptsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
  status = "",
) {
  return ["admin-receipts", token, skip, limit, q, status] as const;
}

export function useAdminReceiptsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  /** Must come from DB admin_console_chrome.payments.list_page_size (never invent). */
  limit = 0,
  q = "",
  status = "",
) {
  const hydrated = useAuthHydrated();
  const query = q.trim();
  const statusF = status.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminReceiptsQueryKey(token, skip, limit, query, statusF),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminReceiptsListResponse> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminReceiptsListResponse>("/payments/receipts", {
        headers: authHeaders(token),
        params: {
          skip,
          limit,
          ...(query ? { q: query } : {}),
          ...(statusF ? { status: statusF } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
