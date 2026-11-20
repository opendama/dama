import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { type ConsoleAdCampaignsPayload, isAdRuntimeConsoleReady } from "@/types/ad-runtime";
import { useQuery } from "@tanstack/react-query";

export type ConsoleAdCampaignsListResponse = ConsoleAdCampaignsPayload & {
  meta: SkipPaginationMeta;
};

export type ConsoleAdCampaignsListFilters = {
  q?: string;
  status?: string;
};

/** Prefix key invalidates all skip/limit pages. Exact page key when skip+limit provided. */
export function consoleAdCampaignsQueryKey(
  token: string | null | undefined,
  skip?: number,
  limit?: number,
  filters: ConsoleAdCampaignsListFilters = {},
) {
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  if (typeof skip === "number" && typeof limit === "number") {
    return ["console-ad-campaigns", token, skip, limit, q, status] as const;
  }
  return ["console-ad-campaigns", token] as const;
}

export function useConsoleAdCampaignsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip = 0,
  limit = 0,
  filters: ConsoleAdCampaignsListFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleAdCampaignsQueryKey(token, skip, limit, { q, status }),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ConsoleAdCampaignsListResponse> => {
      const { data } = await restClient.get<ConsoleAdCampaignsListResponse>(
        "/console/ads/campaigns",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            skip,
            limit,
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
          },
        },
      );
      const chrome = data?.chrome;
      const unavailable = (chrome?.playback_unavailable || chrome?.unavailable || "").trim();
      if (
        !unavailable ||
        !chrome?.campaigns_title ||
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
        !chrome.no_campaigns ||
        !chrome.load_campaigns_failed ||
        !chrome.save_campaign_schedule_action ||
        !isAdRuntimeConsoleReady(chrome) ||
        !chrome.toast_schedule_saved ||
        !chrome.toast_status_updated ||
        !chrome.toast_save_failed ||
        !chrome.toast_update_failed ||
        !chrome.meta_separator ||
        !chrome.runtime_permission_key ||
        !chrome.campaigns_permission_key ||
        !data.bounds ||
        data.bounds.impression_cap_min < 1 ||
        data.bounds.non_skippable_min < 1 ||
        data.bounds.non_skippable_max < data.bounds.non_skippable_min ||
        data.bounds.first_show_min < 0 ||
        data.bounds.interval_min < 1 ||
        !data.meta
      ) {
        throw new Error(unavailable);
      }
      return data;
    },
  });
}
