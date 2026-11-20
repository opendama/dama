import { MeDocument } from "@/gql/graphql";
import { clientNavFullQueryKey } from "@/hooks/query/useClientNavFullQuery";
import { graphqlRequest } from "@/lib/graphql";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { ClientNavPayload } from "@/types/platform";
import type { MeProfile } from "@/types/player";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type { MeProfile, MeSummary, RecentMatch } from "@/types/player";

export function meQueryKey(token: string | null | undefined) {
  return ["me", token] as const;
}

export function useMeQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  const qc = useQueryClient();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: meQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async (): Promise<MeProfile | null> => {
      const empty = (
        qc.getQueryData<ClientNavPayload>(clientNavFullQueryKey())?.graphql_empty || ""
      ).trim();
      const res = await graphqlRequest(MeDocument, undefined, token, empty);
      return res.me ?? null;
    },
  });
}
