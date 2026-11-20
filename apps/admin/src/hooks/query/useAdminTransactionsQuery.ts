import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ConsoleTransaction } from "@/types/console";
import { useQuery } from "@tanstack/react-query";

export type AdminTransactionsListResponse = {
  transactions: ConsoleTransaction[];
  meta: SkipPaginationMeta;
};

export function adminTransactionsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  q = "",
  status = "",
  kind = "",
) {
  return ["admin-transactions", token, skip, limit, q, status, kind] as const;
}

export function useAdminTransactionsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  q = "",
  status = "",
  kind = "",
) {
  const hydrated = useAuthHydrated();
  const query = q.trim();
  const statusF = status.trim();
  const kindF = kind.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminTransactionsQueryKey(token, skip, limit, query, statusF, kindF),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<AdminTransactionsListResponse> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<AdminTransactionsListResponse>(
        "/console/transactions",
        {
          headers: authHeaders(token),
          params: {
            skip,
            limit,
            ...(query ? { q: query } : {}),
            ...(statusF ? { status: statusF } : {}),
            ...(kindF ? { kind: kindF } : {}),
          },
        },
      );
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
