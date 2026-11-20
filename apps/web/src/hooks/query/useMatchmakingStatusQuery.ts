import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { MatchmakingStatus } from "@/types/player";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type { MatchmakingStatus } from "@/types/player";

export function matchmakingStatusQueryKey(token: string | null | undefined) {
  return ["matchmaking-status", token] as const;
}

export function useMatchmakingStatusQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.live,
    placeholderData: keepPreviousData,
    queryKey: matchmakingStatusQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async (): Promise<MatchmakingStatus> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<MatchmakingStatus>("/matchmaking/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        size: typeof data.size === "number" ? data.size : undefined,
        queued: Boolean(data.queued),
      };
    },
    refetchInterval: 15_000,
  });
}
