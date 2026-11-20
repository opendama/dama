import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { BoardRules } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function consoleGameRulesQueryKey(token: string | null | undefined) {
  return ["console-game-rules", token] as const;
}

export function useConsoleGameRulesQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleGameRulesQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<BoardRules>("/console/game-rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
