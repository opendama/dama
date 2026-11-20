import { restClient } from "@/lib/api";
import { softCommunityChromeUnavailable } from "@/lib/community-player-chrome-soft";
import { QueryStale } from "@/lib/query-policy";
import { type HomeSurfaceChrome, isHomeSurfaceChromeReady } from "@/types/home-chrome";
import { useQuery } from "@tanstack/react-query";

export function homeChromeQueryKey() {
  return ["home-chrome"] as const;
}

export function useHomeChromeQuery(enabled = true) {
  return useQuery({
    queryKey: homeChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<HomeSurfaceChrome> => {
      const { data } = await restClient.get<HomeSurfaceChrome>("/public/home-chrome");
      if (!isHomeSurfaceChromeReady(data)) {
        const msg = softCommunityChromeUnavailable((data?.home_chrome_unavailable || "").trim());
        throw new Error(msg);
      }
      return data;
    },
  });
}
