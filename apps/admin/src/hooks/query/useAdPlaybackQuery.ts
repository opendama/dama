import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { type AdPlaybackConsolePayload, isAdRuntimeConsoleReady } from "@/types/ad-runtime";
import { useQuery } from "@tanstack/react-query";

export function adPlaybackQueryKey(token: string | null | undefined) {
  return ["console-ad-playback", token] as const;
}

export function useAdPlaybackQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adPlaybackQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<AdPlaybackConsolePayload>("/console/ads/playback", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pb = data?.playback;
      const chrome = data?.chrome;
      const unavailable = (chrome?.playback_unavailable || chrome?.unavailable || "").trim();
      if (
        !pb ||
        !unavailable ||
        !chrome?.section_title ||
        !chrome.page_body ||
        !chrome.non_skippable_label ||
        !chrome.first_show_label ||
        !chrome.interval_label ||
        !chrome.daily_cap_label ||
        !chrome.weekly_cap_label ||
        !chrome.monthly_cap_label ||
        !chrome.yearly_cap_label ||
        !chrome.schedule_enabled_label ||
        !chrome.status_label ||
        !chrome.update_status_action ||
        !chrome.platform_default_placeholder ||
        !chrome.unlimited_cap_placeholder ||
        !chrome.campaigns_title ||
        !chrome.no_campaigns ||
        !chrome.load_campaigns_failed ||
        !chrome.save_action ||
        !isAdRuntimeConsoleReady(chrome) ||
        !chrome.save_campaign_schedule_action ||
        !chrome.lacks_permissions ||
        !chrome.toast_playback_saved ||
        !chrome.toast_schedule_saved ||
        !chrome.toast_status_updated ||
        !chrome.toast_save_failed ||
        !chrome.toast_update_failed ||
        !chrome.meta_separator ||
        !chrome.runtime_permission_key ||
        !chrome.campaigns_permission_key ||
        pb.non_skippable_min < 1 ||
        pb.non_skippable_max < pb.non_skippable_min ||
        pb.impression_cap_min < 1 ||
        pb.console_campaigns_limit < 1 ||
        pb.non_skippable_seconds < pb.non_skippable_min ||
        pb.non_skippable_seconds > pb.non_skippable_max
      ) {
        throw new Error(unavailable);
      }
      return data;
    },
  });
}
