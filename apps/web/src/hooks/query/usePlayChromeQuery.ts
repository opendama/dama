import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type PlayChrome, isPlayChromeReady } from "@/types/play-chrome";
import { useQuery } from "@tanstack/react-query";

export function playChromeQueryKey() {
  // v2: official pause banner keys (migration 496).
  return ["play-chrome", "v3"] as const;
}

export function usePlayChromeQuery(enabled = true) {
  return useQuery({
    queryKey: playChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<PlayChrome> => {
      const { data } = await restClient.get<PlayChrome>("/public/play-chrome");
      if (!isPlayChromeReady(data)) {
        const msg = (data?.play_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
