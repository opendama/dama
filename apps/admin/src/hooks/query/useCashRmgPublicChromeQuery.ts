import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { CashRmgPublicChromeResponse } from "@/types/console";
import { useQuery } from "@tanstack/react-query";

export const cashRmgPublicChromeQueryKey = ["public-cash-rmg-chrome"] as const;

export function useCashRmgPublicChromeQuery(enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: cashRmgPublicChromeQueryKey,
    enabled,
    queryFn: async (): Promise<CashRmgPublicChromeResponse> => {
      const { data } = await restClient.get<CashRmgPublicChromeResponse>("/public/cash-rmg-chrome");
      return data;
    },
  });
}
