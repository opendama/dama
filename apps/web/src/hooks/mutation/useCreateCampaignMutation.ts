import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdPublisher } from "@/lib/invalidate";
import type { AdPlayback } from "@/types/ad-playback";
import type { AdCampaign, CreateCampaignInput } from "@/types/ads";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateCampaignMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput): Promise<AdCampaign> => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const lat = Number(input.geoLat.trim());
      const lng = Number(input.geoLng.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        throw new Error((chrome?.map_pin_required || "").trim());
      }
      const cap = Number(input.dailySpendCap.trim());
      if (!Number.isFinite(cap) || cap <= 0) {
        throw new Error((chrome?.err_daily_spend_cap_required || "").trim());
      }
      const target: Record<string, unknown> = {
        country: input.geoCountry.trim().toUpperCase(),
        lat,
        lng,
      };
      if (input.geoRegion.trim()) target.region = input.geoRegion.trim();
      if (input.geoDistrict.trim()) target.district = input.geoDistrict.trim();

      const creativeType = input.creativeType.trim();
      if (!creativeType) {
        throw new Error((chrome?.playback_unavailable || "").trim());
      }
      const body: Record<string, unknown> = {
        title: input.title,
        creative_type: creativeType,
        geo_targets: [target],
        country_code: (input.countryCode || input.geoCountry || "").trim().toUpperCase(),
        daily_spend_cap: cap,
      };
      if (input.endsAt?.trim()) {
        body.ends_at = input.endsAt.trim();
      }

      const { data } = await restClient.post<AdCampaign>("/ads/campaigns", body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      void invalidateAdPublisher(qc, token);
      if (chrome?.toast_campaign_created) toast.success(chrome.toast_campaign_created);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
