import { locateGeo } from "@/lib/geo-locate";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import type { AdServeGeoQuery } from "@/types/ads";
import { useQuery } from "@tanstack/react-query";

export function playerGeoQueryKey(token?: string | null) {
  return ["player-geo", token ? "auth" : "anon"] as const;
}

async function resolvePlayerGeo(token?: string | null): Promise<AdServeGeoQuery> {
  const empty: AdServeGeoQuery = { country: "" };
  if (typeof navigator === "undefined") return empty;

  const fromLocate = async (lat?: number, lng?: number): Promise<AdServeGeoQuery> => {
    try {
      const res = await locateGeo(token, { latitude: lat, longitude: lng });
      const country = (res.location.country_code || "").toUpperCase();
      return {
        country,
        region: res.location.region?.toLowerCase(),
        district: res.location.city?.toLowerCase(),
        lat,
        lng,
      };
    } catch {
      return empty;
    }
  };

  if (!navigator.geolocation) {
    return fromLocate();
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        resolve(await fromLocate(pos.coords.latitude, pos.coords.longitude));
      },
      async () => resolve(await fromLocate()),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** Player geo for ad serve + payment route hydrate. Authenticated when token present. */
export function usePlayerGeoQuery(enabled = true) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: playerGeoQueryKey(token),
    enabled,
    staleTime: QueryStale.geo,
    queryFn: () => resolvePlayerGeo(token),
  });
}
