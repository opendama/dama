import { ConsoleFeatureFlagsDocument } from "@/gql/graphql";
import { consoleNavQueryKey } from "@/hooks/query/useConsoleNavQuery";
import { graphqlRequest } from "@/lib/graphql";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ConsoleFeatureFlags } from "@/types";
import type { ConsoleNavPayload } from "@/types/console";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function consoleFeatureFlagsQueryKey(token?: string | null) {
  return ["gql-feature-flags", token] as const;
}

export function useConsoleFeatureFlagsQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  const qc = useQueryClient();
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: consoleFeatureFlagsQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async (): Promise<ConsoleFeatureFlags> => {
      const empty = (
        qc.getQueryData<ConsoleNavPayload>(consoleNavQueryKey())?.graphql_empty || ""
      ).trim();
      const res = await graphqlRequest(ConsoleFeatureFlagsDocument, undefined, token, empty);
      return res.consoleFeatureFlags;
    },
  });
}
