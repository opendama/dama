import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ClientNavPayload, ClientNavSurface } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export function clientNavQueryKey() {
  return ["client-nav"] as const;
}

export function useClientNavQuery(surface: ClientNavSurface, enabled = true) {
  return useQuery({
    queryKey: [...clientNavQueryKey(), surface] as const,
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ClientNavPayload>("/platform/client-nav");
      return data[surface] ?? [];
    },
  });
}
