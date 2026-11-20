import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ProgressionPayload } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function consoleProgressionQueryKey(token: string | null | undefined) {
  return ["console-progression", token] as const;
}

export function useConsoleProgressionQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleProgressionQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<ProgressionPayload>("/console/progression", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
