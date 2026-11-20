import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { AdPlayback, AdScheduleChrome } from "@/types/ad-playback";
import { useQuery } from "@tanstack/react-query";

export function adPlaybackQueryKey() {
  return ["ad-playback"] as const;
}

const SCHEDULE_CHROME_KEYS: (keyof AdScheduleChrome)[] = [
  "schedule_enabled_label",
  "non_skippable_label",
  "first_show_label",
  "interval_label",
  "daily_cap_label",
  "weekly_cap_label",
  "monthly_cap_label",
  "yearly_cap_label",
  "platform_default_placeholder",
  "unlimited_cap_placeholder",
  "save_campaign_schedule_action",
  "publisher_page_title",
  "publisher_page_body",
  "toast_schedule_saved",
  "toast_save_failed",
  "toast_campaign_created",
  "toast_campaign_status_updated",
  "toast_creative_replaced",
  "toast_video_attached",
  "video_upload_job_title",
  "ph_title",
  "ph_country",
  "ph_region",
  "ph_district",
  "ph_daily_spend_cap",
  "daily_spend_cap_label",
  "daily_spend_cap_suffix",
  "daily_spend_cap_required_hint",
  "err_daily_spend_cap_required",
  "status_label",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "bulk_apply_status_action",
  "bulk_status_pending",
  "delete_campaign_action",
  "delete_campaign_pending",
  "delete_campaign_confirm_title",
  "delete_campaign_confirm_description",
  "toast_campaign_deleted",
  "toast_campaign_delete_failed",
  "err_delete_has_delivery",
  "err_delete_auto_closed",
  "publisher_portal_transfer_label",
  "publisher_portal_transfer_href",
  "close_campaign_action",
  "reopen_campaign_action",
  "cannot_reopen_campaign_blurb",
  "toast_campaign_closed",
  "toast_campaign_reopened",
  "toast_campaign_close_failed",
  "toast_campaign_reopen_failed",
  "auto_closed_badge",
  "ends_at_label",
  "ends_at_blurb",
  "ph_ends_at",
  "campaign_create_fee_label",
  "campaign_create_fee_blurb",
  "insufficient_campaign_create_fee",
  "publisher_portal_overview_href",
  "publisher_portal_create_href",
  "publisher_portal_wallet_href",
  "publisher_portal_receipts_href",
  "publisher_portal_transactions_href",
  "publisher_portal_payout_label",
  "publisher_portal_payout_href",
  "publisher_portal_payout_blurb",
  "create_action",
  "create_pending",
  "replace_creative_action",
  "replace_creative_pending",
  "attach_video_action",
  "attach_video_pending",
  "update_status_pending",
  "save_campaign_schedule_pending",
  "thumbnail_upload_pending",
  "gallery_upload_pending",
  "publisher_no_campaigns",
  "creative_url_prompt",
  "creative_url_required",
  "stats_impressions_suffix",
  "stats_reach_suffix",
  "stats_clicks_suffix",
  "video_attached_suffix",
  "daily_cap_suffix",
  "publisher_dash_title",
  "publisher_dash_body",
  "publisher_dash_load_failed",
  "publisher_stat_impressions",
  "publisher_stat_reach",
  "publisher_stat_clicks",
  "publisher_stat_ctr",
  "publisher_stat_cpc",
  "publisher_stat_completion",
  "publisher_stat_create_fee",
  "publisher_stat_source_note",
  "publisher_campaigns_heading",
  "publisher_manage_campaigns",
  "publisher_manage_campaigns_href",
  "publisher_analytics_title",
  "publisher_analytics_body",
  "publisher_pricing_unavailable",
  "publisher_invoice_action",
  "publisher_invoice_pending",
  "publisher_invoice_failed",
  "publisher_invoice_filename",
  "publisher_portal_wallet_label",
  "publisher_portal_receipts_label",
  "publisher_portal_transactions_label",
  "publisher_portal_overview_label",
  "publisher_portal_create_label",
  "publisher_portal_section_title",
  "playback_unavailable",
  "meta_separator",
  "amount_currency_separator",
  "paren_open",
  "paren_close",
  "list_page_size",
  "empty_value",
  "cancel_action",
  "dialog_close_label",
  "search_campaigns_label",
  "search_campaigns_placeholder",
  "filter_status_label",
  "filter_status_all",
  "view_action",
  "row_actions_label",
  "map_location_section_title",
  "map_pin_empty",
  "map_use_device_location",
  "map_clear_pin",
  "map_helper_text",
  "map_geolocation_unavailable",
  "map_geolocation_failed",
  "map_pin_required",
  "map_pin_coords_fmt",
  "map_listings_count_fmt",
  "map_locate_failed",
];

function scheduleChromePresent(key: keyof AdScheduleChrome, v: unknown): boolean {
  if (typeof v !== "string") return false;
  // Separators / paren wrappers may be intentional whitespace (e.g. amount join " ").
  if (
    key === "amount_currency_separator" ||
    key === "meta_separator" ||
    key === "paren_open" ||
    key === "paren_close"
  ) {
    return v.length > 0;
  }
  return v.trim().length > 0;
}

function scheduleChromeComplete(chrome: AdScheduleChrome | undefined): boolean {
  if (!chrome) return false;
  return SCHEDULE_CHROME_KEYS.every((k) => scheduleChromePresent(k, chrome[k]));
}

export function useAdPlaybackQuery(enabled: boolean) {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: adPlaybackQueryKey(),
    enabled,
    queryFn: async () => {
      const { data } = await restClient.get<AdPlayback>("/ads/playback");
      if (
        !data ||
        data.non_skippable_min < 1 ||
        data.non_skippable_max < data.non_skippable_min ||
        data.non_skippable_seconds < data.non_skippable_min ||
        data.non_skippable_seconds > data.non_skippable_max ||
        data.first_show_after_game_seconds < data.first_show_min ||
        data.default_interval_seconds < data.interval_min ||
        data.impression_cap_min < 1 ||
        !data.player_chrome?.sponsored_label ||
        !data.player_chrome?.skip_in_template ||
        !data.player_chrome?.can_continue_label ||
        !data.player_chrome?.continue_action ||
        !data.player_chrome?.placement_lobby ||
        !data.player_chrome?.placement_in_match ||
        !scheduleChromeComplete(data.schedule_chrome)
      ) {
        throw new Error((data?.schedule_chrome?.playback_unavailable || "").trim());
      }
      return data;
    },
  });
}
