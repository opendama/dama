import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type CashRmgPayload, isCashRmgChromeReady } from "@/types/cash-rmg";
import { useQuery } from "@tanstack/react-query";

export function cashRmgChromeQueryKey() {
  return ["cash-rmg-chrome"] as const;
}

export function useCashRmgChromeQuery(enabled = true) {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: cashRmgChromeQueryKey(),
    enabled,
    queryFn: async () => {
      const { data } = await restClient.get<CashRmgPayload>("/public/cash-rmg-chrome");
      if (!isCashRmgChromeReady(data)) {
        throw new Error((data?.chrome?.cash_rmg_unavailable || "").trim());
      }
      return data;
    },
  });
}
