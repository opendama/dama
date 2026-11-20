import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type LegalChrome, isLegalChromeReady } from "@/types/legal-chrome";
import { useQuery } from "@tanstack/react-query";

export function legalChromeQueryKey() {
  return ["legal-chrome"] as const;
}

export function useLegalChromeQuery(enabled = true) {
  return useQuery({
    queryKey: legalChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<LegalChrome> => {
      const { data } = await restClient.get<LegalChrome>("/public/legal-chrome");
      if (!isLegalChromeReady(data)) {
        const msg = (data?.legal_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
