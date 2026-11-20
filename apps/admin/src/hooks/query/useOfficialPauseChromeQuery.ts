import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import {
  type OfficialPauseChrome,
  isOfficialPauseChromeReady,
} from "@/types/official-pause-chrome";
import { useQuery } from "@tanstack/react-query";

export function officialPauseChromeQueryKey() {
  return ["official-pause-chrome", "v2"] as const;
}

export function useOfficialPauseChromeQuery(enabled = true) {
  return useQuery({
    queryKey: officialPauseChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<OfficialPauseChrome> => {
      const { data } = await restClient.get<OfficialPauseChrome>("/public/official-pause-chrome");
      if (!isOfficialPauseChromeReady(data)) {
        const msg = (data?.official_pause_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
