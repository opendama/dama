import { FeatureFlagsDocument } from "@/gql/graphql";
import { clientNavFullQueryKey } from "@/hooks/query/useClientNavFullQuery";
import { graphqlRequest } from "@/lib/graphql";
import { QueryStale } from "@/lib/query-policy";
import type { ClientNavPayload, GraphqlFeatureFlags } from "@/types/platform";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type { GraphqlFeatureFlags } from "@/types/platform";

export const featureFlagsQueryKey = ["feature-flags"] as const;

export function useFeatureFlagsQuery() {
  const qc = useQueryClient();
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: featureFlagsQueryKey,
    queryFn: async (): Promise<GraphqlFeatureFlags> => {
      const empty = (
        qc.getQueryData<ClientNavPayload>(clientNavFullQueryKey())?.graphql_empty || ""
      ).trim();
      const data = await graphqlRequest(FeatureFlagsDocument, undefined, undefined, empty);
      return data.featureFlags;
    },
  });
}
