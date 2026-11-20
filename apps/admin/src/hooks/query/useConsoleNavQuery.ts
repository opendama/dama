import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ConsoleNavPayload } from "@/types/console";
import { useQuery } from "@tanstack/react-query";

export function consoleNavQueryKey() {
  return ["console-nav"] as const;
}

/** Public platform_settings.console_nav hydrate (no client route hardcodes). */
export function useConsoleNavQuery(enabled = true) {
  return useQuery({
    queryKey: consoleNavQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ConsoleNavPayload>("/platform/console-nav");
      return data;
    },
  });
}
