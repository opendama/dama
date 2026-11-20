import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import type { LocateResult } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";

async function locateCountry(
  token: string | null | undefined,
  input?: {
    latitude?: number;
    longitude?: number;
  },
): Promise<string> {
  try {
    const { data } = await restClient.post<LocateResult>(
      "/geo/locate",
      {
        latitude: input?.latitude,
        longitude: input?.longitude,
      },
      { headers: authHeaders(token) },
    );
    const cc = (data.location?.country_code || "").trim().toUpperCase();
    return cc.length === 2 ? cc : "";
  } catch {
    return "";
  }
}

/** Prefer HTML5 GPS (Nominatim reverse on API), then GeoIP / DB localhost invent.
 * Pay-chain parity with reference: no profile-country fallback.
 * Pass Bearer when available so geo_ip_records bind to the user (cash locate gate). */
export async function detectBrowserCountry(token?: string | null): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return locateCountry(token);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const cc = await locateCountry(token, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (cc) {
          resolve(cc);
          return;
        }
        resolve(await locateCountry(token));
      },
      async () => resolve(await locateCountry(token)),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

export function detectBrowserCountryQueryKey(token?: string | null) {
  return ["detect-browser-country", token ? "auth" : "anon"] as const;
}

export function useDetectBrowserCountryQuery(enabled = true) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: detectBrowserCountryQueryKey(token),
    enabled,
    staleTime: QueryStale.geo,
    queryFn: () => detectBrowserCountry(token),
  });
}
