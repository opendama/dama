import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ClientEnums } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export function clientEnumsQueryKey() {
  return ["client-enums"] as const;
}

export function useClientEnumsQuery(enabled = true) {
  return useQuery({
    queryKey: clientEnumsQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<ClientEnums>("/platform/enums");
      const unavailable = (data?.unavailable || "").trim();
      // `unavailable` is fail-closed chrome copy; readiness is console_roles / roles.
      if (!unavailable || !data?.console_roles?.length || !data.roles?.length) {
        throw new Error(unavailable);
      }
      return data;
    },
  });
}
