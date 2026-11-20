import { PublisherDashboardDocument } from "@/gql/graphql";
import { clientNavFullQueryKey } from "@/hooks/query/useClientNavFullQuery";
import { graphqlRequest } from "@/lib/graphql";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { PublisherDashboard } from "@/types/ads";
import type { ClientNavPayload } from "@/types/platform";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type { PublisherCampaign, PublisherDashboard } from "@/types/ads";

export function publisherDashboardQueryKey(token: string | null | undefined) {
  return ["publisher-dashboard", token] as const;
}

export function usePublisherDashboardQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  const qc = useQueryClient();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: publisherDashboardQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async (): Promise<PublisherDashboard> => {
      const empty = (
        qc.getQueryData<ClientNavPayload>(clientNavFullQueryKey())?.graphql_empty || ""
      ).trim();
      const res = await graphqlRequest(PublisherDashboardDocument, undefined, token, empty);
      return res.publisherDashboard;
    },
  });
}
