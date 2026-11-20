import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { AuthProvidersResponse } from "@/types/auth-providers";
import { useQuery } from "@tanstack/react-query";

export function authProvidersQueryKey() {
  return ["auth-providers"] as const;
}

export function useAuthProvidersQuery() {
  return useQuery({
    queryKey: authProvidersQueryKey(),
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<AuthProvidersResponse> => {
      const { data } = await restClient.get<AuthProvidersResponse>("/public/auth-providers");
      return data;
    },
  });
}
