import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type SpectateChrome, isSpectateChromeReady } from "@/types/spectate-chrome";
import { useQuery } from "@tanstack/react-query";

export function spectateChromeQueryKey() {
  return ["spectate-chrome"] as const;
}

export function useSpectateChromeQuery(enabled = true) {
  return useQuery({
    queryKey: spectateChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<SpectateChrome> => {
      const { data } = await restClient.get<SpectateChrome>("/public/spectate-chrome");
      if (!isSpectateChromeReady(data)) {
        const msg = (data?.spectate_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
