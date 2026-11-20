import { authHeaders, restClient } from "@/lib/api";
import type { LocateResult } from "@/types/payments";

/** POST /geo/locate with optional GPS coords (smart-menu Nominatim reverse via Dama API). */
export async function locateGeo(
  token: string | null | undefined,
  input: { latitude?: number; longitude?: number } = {},
): Promise<LocateResult> {
  const body: Record<string, number> = {};
  if (typeof input.latitude === "number" && Number.isFinite(input.latitude)) {
    body.latitude = input.latitude;
  }
  if (typeof input.longitude === "number" && Number.isFinite(input.longitude)) {
    body.longitude = input.longitude;
  }
  const { data } = await restClient.post<LocateResult>("/geo/locate", body, {
    headers: authHeaders(token),
  });
  return {
    location: {
      country_code: data.location?.country_code ?? "",
      country_name: data.location?.country_name,
      region: data.location?.region,
      city: data.location?.city,
    },
    route: {
      provider: data.route?.provider ?? "",
      currency: data.route?.currency ?? "",
      country_code: data.route?.country_code ?? "",
    },
  };
}
