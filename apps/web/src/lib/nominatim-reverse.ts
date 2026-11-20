/**
 * Client Nominatim reverse - mirrors smart-menu `reverseGeocodeWithGeoapify`
 * (zoom 18 → 16). English labels. Short timeouts so locate fallback stays snappy.
 */

export type NominatimReverseResult = {
  countryCode: string;
  region: string;
  city: string;
  countryName: string;
};

type NominatimAddress = {
  country_code?: string;
  country?: string;
  state?: string;
  state_district?: string;
  region?: string;
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  ward?: string;
  city_district?: string;
  district?: string;
  county?: string;
  hamlet?: string;
};

function firstNonEmpty(...vals: Array<string | undefined>): string {
  for (const v of vals) {
    const s = (v || "").trim();
    if (s) return s;
  }
  return "";
}

function cityAndSubCity(address: NominatimAddress): { city: string; subCity: string } {
  const city = firstNonEmpty(
    address.state_district,
    address.city,
    address.town,
    address.municipality,
    address.state,
    address.region,
    address.village,
  );
  const subOpts = [
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.ward,
    address.city_district,
    address.district,
    address.county,
    address.hamlet,
    address.village,
  ];
  let subCity = "";
  for (const opt of subOpts) {
    const s = (opt || "").trim();
    if (s && s.toLowerCase() !== city.toLowerCase()) {
      subCity = s;
      break;
    }
  }
  return { city, subCity };
}

async function nominatimOnce(
  lat: number,
  lng: number,
  zoom: number,
): Promise<NominatimReverseResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
    // Fail fast - Docker/host often blocks Nominatim; server /geo/locate is the backup.
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { address?: NominatimAddress };
  const address = data?.address;
  if (!address) return null;
  const countryCode = (address.country_code || "").trim().toUpperCase();
  if (countryCode.length !== 2) return null;
  const { city, subCity } = cityAndSubCity(address);
  if (!city) return null;
  return {
    countryCode,
    region: city,
    city: subCity,
    countryName: (address.country || "").trim(),
  };
}

export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<NominatimReverseResult | null> {
  try {
    const primary = await nominatimOnce(lat, lng, 18);
    if (primary) return primary;
    await new Promise((r) => setTimeout(r, 100));
    return await nominatimOnce(lat, lng, 16);
  } catch {
    return null;
  }
}
