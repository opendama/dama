import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { BoardRulesConfig } from "@/types/game";
import { useQuery } from "@tanstack/react-query";

export const boardRulesQueryKey = ["board-rules"] as const;

export function useBoardRulesQuery() {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: boardRulesQueryKey,
    queryFn: async (): Promise<BoardRulesConfig> => {
      const { data } = await restClient.get<BoardRulesConfig>("/game/rules");
      return data;
    },
  });
}
