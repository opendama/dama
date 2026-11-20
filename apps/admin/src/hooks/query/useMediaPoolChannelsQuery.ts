import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { MediaPoolChannel } from "@/types";
import { useQuery } from "@tanstack/react-query";

export type MediaPoolChannelsListResponse = {
  channels: MediaPoolChannel[];
  meta: SkipPaginationMeta;
};

export type MediaPoolChannelsFilters = {
  q?: string;
  status?: string;
};

export function mediaPoolChannelsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: MediaPoolChannelsFilters = {},
) {
  return [
    "media-pool-channels",
    token,
    skip,
    limit,
    (filters.q || "").trim(),
    (filters.status || "").trim(),
  ] as const;
}

export function useMediaPoolChannelsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  filters: MediaPoolChannelsFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: mediaPoolChannelsQueryKey(token, skip, limit, { q, status }),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<MediaPoolChannelsListResponse> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<MediaPoolChannelsListResponse>("/media/pool/channels", {
        headers: authHeaders(token),
        params: {
          skip,
          limit,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
