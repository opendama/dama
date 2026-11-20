import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { AdPricing } from "@/types/ads";
import { useQuery } from "@tanstack/react-query";

export type { AdPricing } from "@/types/ads";

export const adPricingQueryKey = ["ad-pricing"] as const;

function pinPricingKey(lat: number | null | undefined, lng: number | null | undefined) {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return { hasPin: false as const, lat: null, lng: null };
  }
  return { hasPin: true as const, lat, lng };
}

export function useAdPricingQuery(lat?: number | null, lng?: number | null) {
  const pin = pinPricingKey(lat, lng);
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: [...adPricingQueryKey, pin.hasPin ? pin.lat : null, pin.hasPin ? pin.lng : null],
    queryFn: async () => {
      const { data } = await restClient.get<AdPricing>(
        "/ads/pricing",
        pin.hasPin ? { params: { lat: pin.lat, lng: pin.lng } } : undefined,
      );
      if (
        !data ||
        !(data.impression_unit_cost > 0) ||
        !(data.campaign_create_fee_amount > 0) ||
        !(data.campaign_create_fee_currency || "").trim()
      ) {
        // Fail closed empty; UI surfaces publisher_pricing_unavailable from schedule chrome.
        throw new Error("");
      }
      return data;
    },
  });
}
