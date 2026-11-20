import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { AdServeGeoQuery, ServedAd } from "@/types/ads";
import { useQuery } from "@tanstack/react-query";

export type { AdServeGeoQuery, ServedAd } from "@/types/ads";

export function serveAdsQueryKey(geo: AdServeGeoQuery | null) {
  return [
    "ads-serve",
    geo?.country ?? "",
    geo?.region ?? "",
    geo?.district ?? "",
    geo?.lat ?? null,
    geo?.lng ?? null,
  ] as const;
}

/** Server resolves match country from IP/GPS; optional lat/lng only for radius match. */
export function useServeAdsQuery(geo: AdServeGeoQuery | null, enabled = true) {
  const ready = Boolean(geo && (geo.country || geo.lat != null));
  return useQuery({
    /** Ad rotation / serve payloads should refetch on remount after impressions. */
    staleTime: QueryStale.live,
    queryKey: serveAdsQueryKey(geo),
    enabled: enabled && ready,
    queryFn: async (): Promise<ServedAd[]> => {
      if (!geo) return [];
      const params = new URLSearchParams();
      // Lat/lng optional for GPS reverse + radius; country query ignored by API.
      if (geo.lat != null) params.set("lat", String(geo.lat));
      if (geo.lng != null) params.set("lng", String(geo.lng));
      const qs = params.toString();
      const { data } = await restClient.get<{ campaigns: ServedAd[] }>(
        qs ? `/ads/serve?${qs}` : "/ads/serve",
      );
      return data.campaigns ?? [];
    },
  });
}
