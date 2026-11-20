import { MeDocument } from "@/gql/graphql";
import { consoleNavQueryKey } from "@/hooks/query/useConsoleNavQuery";
import { graphqlRequest } from "@/lib/graphql";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { MeProfile } from "@/types/auth";
import type { ConsoleNavPayload } from "@/types/console";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
        qc.getQueryData<ConsoleNavPayload>(consoleNavQueryKey())?.graphql_empty || ""
      ).trim();
      const res = await graphqlRequest(MeDocument, undefined, token, empty);
      return res.me ?? null;
    },
  });
}
