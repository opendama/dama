import { QueryGcTime, QueryStale } from "@/lib/query-policy";
import { QueryClient, keepPreviousData } from "@tanstack/react-query";

/**
 * Cache-first navigation: soft route changes reuse data until staleTime.
 * keepPreviousData keeps prior paint during key changes / remounts.
 * Shimmers use isLoading (no cached data), never isFetching, so back/forward
 * does not remount full-page skeletons while a background refetch runs.
 */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QueryStale.session,
        gcTime: QueryGcTime,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        /** Refetch only when stale; fresh cache paints immediately on nav. */
        refetchOnMount: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
