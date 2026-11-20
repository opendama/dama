import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ThemeChrome } from "@/types/theme-chrome";
import { useQuery } from "@tanstack/react-query";

export function themeChromeQueryKey() {
  return ["theme-chrome"] as const;
}

/** DB-backed theme toggle chrome from GET /public/theme-chrome. */
export function useThemeChromeQuery(enabled = true) {
  return useQuery({
    queryKey: themeChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ThemeChrome>("/public/theme-chrome");
      return data;
    },
  });
}
