import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import {
  type StoreComplianceChrome,
  isStoreComplianceChromeReady,
} from "@/types/store-compliance-chrome";
import { useQuery } from "@tanstack/react-query";

export function storeComplianceChromeQueryKey() {
  return ["store-compliance-chrome"] as const;
}

export function useStoreComplianceChromeQuery(enabled = true) {
  return useQuery({
    queryKey: storeComplianceChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<StoreComplianceChrome> => {
      const { data } = await restClient.get<StoreComplianceChrome>(
        "/public/store-compliance-chrome",
      );
      if (!isStoreComplianceChromeReady(data)) {
        const msg = (data?.store_compliance_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
