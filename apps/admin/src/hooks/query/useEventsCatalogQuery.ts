import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { type EventsCatalogConfig, isEventsCatalogReady } from "@/types/events-catalog";
import { useQuery } from "@tanstack/react-query";

export function eventsCatalogQueryKey(token: string | null | undefined) {
  return ["console-events-catalog", token] as const;
}

export function useEventsCatalogQuery(
  token: string | null | undefined,
  enabled: boolean,
  loadFailedMessage?: string,
) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventsCatalogQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async (): Promise<EventsCatalogConfig> => {
      const { data } = await restClient.get<EventsCatalogConfig>("/console/events/catalog", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!isEventsCatalogReady(data)) {
        throw new Error((loadFailedMessage || "").trim());
      }
      return data;
    },
  });
}
