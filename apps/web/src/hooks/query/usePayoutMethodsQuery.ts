import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { PayoutMethod } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";

export type PayoutMethodsPage = {
  methods: PayoutMethod[];
  meta: SkipPaginationMeta;
};

export function payoutMethodsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
) {
  return ["payout-methods", token, skip, limit] as const;
}

export function usePayoutMethodsQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: payoutMethodsQueryKey(token, skip, limit),
    enabled: hydrated && enabled && Boolean(token) && limit > 0,
    queryFn: async (): Promise<PayoutMethodsPage> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<PayoutMethodsPage>("/payouts/methods", {
        headers: authHeaders(token),
        params: { skip, limit },
      });
      return {
        methods: data.methods ?? [],
        meta: data.meta,
      };
    },
  });
}
