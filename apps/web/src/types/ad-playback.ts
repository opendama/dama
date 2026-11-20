import { viewportAspectRatioFromLabel } from "@/lib/resolve-viewport-creative";

export type AdPlayerChrome = {
  sponsored_label: string;
  skip_in_template: string;
  can_continue_label: string;
  continue_action: string;
  placement_lobby: string;
  placement_in_match: string;
  unavailable: string;
};

export type AdScheduleChrome = {
  schedule_enabled_label: string;
  non_skippable_label: string;
  first_show_label: string;
  interval_label: string;
  daily_cap_label: string;
  weekly_cap_label: string;
  monthly_cap_label: string;
  yearly_cap_label: string;
  platform_default_placeholder: string;
  unlimited_cap_placeholder: string;
  save_campaign_schedule_action: string;
  publisher_page_title: string;
  publisher_page_body: string;
  toast_schedule_saved: string;
  toast_save_failed: string;
  toast_campaign_created: string;
  toast_campaign_status_updated: string;
  toast_campaign_title_saved?: string;
  toast_creative_replaced: string;
  toast_video_attached: string;
  video_upload_job_title: string;
  ph_title: string;
  save_action?: string;
  save_pending?: string;
  patch_title_locked?: string;
  ph_country: string;
  ph_region: string;
  ph_district: string;
  /** Legacy; unused after map pin UI (not required for chrome-ready). */
  ph_lat?: string;
  ph_lng?: string;
  ph_daily_spend_cap: string;
  close_campaign_action: string;
  reopen_campaign_action: string;
  cannot_reopen_campaign_blurb: string;
  toast_campaign_closed: string;
  toast_campaign_reopened: string;
  toast_campaign_close_failed: string;
  toast_campaign_reopen_failed: string;
  auto_closed_badge: string;
  ends_at_label: string;
  ends_at_blurb: string;
  ph_ends_at: string;
  campaign_create_fee_label: string;
  campaign_create_fee_blurb: string;
  insufficient_campaign_create_fee: string;
  publisher_portal_overview_href: string;
  publisher_portal_create_href: string;
  create_action: string;
  create_pending: string;
  replace_creative_action: string;
  replace_creative_pending: string;
  attach_video_action: string;
  attach_video_pending: string;
  update_status_pending: string;
  save_campaign_schedule_pending: string;
  thumbnail_upload_pending: string;
  gallery_upload_pending: string;
  publisher_no_campaigns: string;
  creative_url_prompt: string;
  creative_url_required: string;
  stats_impressions_suffix: string;
  stats_reach_suffix: string;
  stats_clicks_suffix: string;
  video_attached_suffix: string;
  daily_cap_suffix: string;
  daily_spend_cap_suffix: string;
  publisher_dash_title: string;
  publisher_dash_body: string;
  publisher_dash_load_failed: string;
  publisher_stat_impressions: string;
  publisher_stat_reach: string;
  publisher_stat_clicks: string;
  publisher_stat_ctr: string;
  publisher_stat_cpc: string;
  publisher_stat_completion: string;
  publisher_stat_create_fee: string;
  publisher_stat_source_note: string;
  publisher_campaigns_heading: string;
  publisher_manage_campaigns: string;
  publisher_manage_campaigns_href: string;
  publisher_analytics_title: string;
  publisher_analytics_body: string;
  publisher_pricing_unavailable: string;
  publisher_invoice_action: string;
  publisher_invoice_pending: string;
  publisher_invoice_failed: string;
  publisher_invoice_filename: string;
  publisher_portal_wallet_label: string;
  publisher_portal_receipts_label: string;
  publisher_portal_transactions_label: string;
  publisher_portal_overview_label: string;
  publisher_portal_create_label: string;
  publisher_portal_section_title: string;
  publisher_portal_wallet_href: string;
  publisher_portal_receipts_href: string;
  publisher_portal_transactions_href: string;
  publisher_portal_payout_label: string;
  publisher_portal_payout_href: string;
  publisher_portal_payout_blurb: string;
  playback_unavailable: string;
  meta_separator: string;
  amount_currency_separator: string;
  paren_open: string;
  paren_close: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size: string;
  /** DB chrome for missing numeric cells; never invent "-" / 0. */
  empty_value: string;
  cancel_action: string;
  dialog_close_label: string;
  search_campaigns_label: string;
  search_campaigns_placeholder: string;
  filter_status_label: string;
  filter_status_all: string;
  view_action: string;
  edit_action?: string;
  status_label: string;
  daily_spend_cap_label: string;
  row_actions_label: string;
  select_all_label: string;
  select_row_label: string;
  selected_count_fmt: string;
  clear_selection_action: string;
  bulk_apply_status_action: string;
  bulk_status_pending: string;
  delete_campaign_action: string;
  delete_campaign_pending: string;
  delete_campaign_confirm_title: string;
  delete_campaign_confirm_description: string;
  toast_campaign_deleted: string;
  toast_campaign_delete_failed: string;
  err_delete_has_delivery: string;
  err_delete_auto_closed: string;
  err_daily_spend_cap_required: string;
  daily_spend_cap_required_hint: string;
  publisher_portal_transfer_label: string;
  publisher_portal_transfer_href: string;
  /** Optional until ad_runtime_chrome media keys are hydrated from DB. */
  thumbnail_label?: string;
  gallery_label?: string;
  gallery_add_action?: string;
  gallery_empty?: string;
  gallery_max_slots?: string;
  gallery_slots_fmt?: string;
  thumbnail_main_badge?: string;
  thumbnail_empty_hint?: string;
  thumbnail_hint?: string;
  gallery_limit_reached?: string;
  thumbnail_upload_action?: string;
  toast_thumbnail_saved?: string;
  toast_gallery_saved?: string;
  media_upload_failed?: string;
  map_location_section_title: string;
  map_pin_empty: string;
  map_use_device_location: string;
  map_clear_pin: string;
  map_helper_text: string;
  map_geolocation_unavailable: string;
  map_geolocation_failed: string;
  map_pin_required: string;
  map_pin_coords_fmt: string;
  map_listings_count_fmt: string;
  map_locate_failed: string;
  /** Optional until viewport chrome keys are hydrated from DB. */
  viewport_creatives_title?: string;
  viewport_creatives_blurb?: string;
  viewport_desktop_label?: string;
  viewport_tablet_label?: string;
  viewport_mobile_label?: string;
  viewport_desktop_ratio_label?: string;
  viewport_tablet_ratio_label?: string;
  viewport_mobile_ratio_label?: string;
  viewport_desktop_hint?: string;
  viewport_tablet_hint?: string;
  viewport_mobile_hint?: string;
  viewport_upload_image_action?: string;
  viewport_upload_video_action?: string;
  viewport_replace_image_action?: string;
  viewport_clear_action?: string;
  viewport_preview_empty?: string;
  viewport_optional_badge?: string;
  viewport_video_badge?: string;
  viewport_image_badge?: string;
  viewport_ratio_mismatch?: string;
  viewport_slot_invalid?: string;
  viewport_breakpoint_mobile_max?: string;
  viewport_breakpoint_tablet_max?: string;
  viewport_aspect_tolerance?: string;
  viewport_max_video_bytes?: string;
  err_viewport_slot_required?: string;
  err_viewport_ratio_mismatch?: string;
  err_viewport_video_required?: string;
  err_viewport_video_type?: string;
  err_viewport_video_too_large?: string;
  toast_viewport_creative_saved?: string;
  toast_viewport_creative_cleared?: string;
  toast_viewport_video_queued?: string;
  clear_legacy_video_action?: string;
  toast_legacy_video_cleared?: string;
};

const AD_MEDIA_CHROME_KEYS = [
  "thumbnail_label",
  "gallery_label",
  "gallery_add_action",
  "gallery_empty",
  "gallery_max_slots",
  "gallery_slots_fmt",
  "thumbnail_main_badge",
  "thumbnail_empty_hint",
  "thumbnail_hint",
  "gallery_limit_reached",
  "thumbnail_upload_action",
  "toast_thumbnail_saved",
  "toast_gallery_saved",
  "media_upload_failed",
] as const;

const AD_MAP_CHROME_KEYS = [
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
] as const;

const VIEWPORT_CREATIVES_CHROME_KEYS = [
  "viewport_creatives_title",
  "viewport_creatives_blurb",
  "viewport_desktop_label",
  "viewport_tablet_label",
  "viewport_mobile_label",
  "viewport_desktop_ratio_label",
  "viewport_tablet_ratio_label",
  "viewport_mobile_ratio_label",
  "viewport_desktop_hint",
  "viewport_tablet_hint",
  "viewport_mobile_hint",
  "viewport_upload_image_action",
  "viewport_upload_video_action",
  "viewport_replace_image_action",
  "viewport_clear_action",
  "viewport_preview_empty",
  "viewport_optional_badge",
  "viewport_video_badge",
  "viewport_image_badge",
  "viewport_breakpoint_mobile_max",
  "viewport_breakpoint_tablet_max",
  "viewport_aspect_tolerance",
  "viewport_max_video_bytes",
  "toast_viewport_creative_saved",
  "toast_viewport_creative_cleared",
  "toast_viewport_video_queued",
  "media_upload_failed",
] as const;

/** Fail closed: per-viewport campaign creative upload chrome from ad_runtime_chrome. */
export function isViewportCreativesChromeReady(
  chrome: AdScheduleChrome | null | undefined,
): chrome is AdScheduleChrome &
  Required<Pick<AdScheduleChrome, (typeof VIEWPORT_CREATIVES_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  const keysOk = VIEWPORT_CREATIVES_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
  if (!keysOk) return false;
  if (
    !viewportAspectRatioFromLabel(chrome.viewport_desktop_ratio_label) ||
    !viewportAspectRatioFromLabel(chrome.viewport_tablet_ratio_label) ||
    !viewportAspectRatioFromLabel(chrome.viewport_mobile_ratio_label)
  ) {
    return false;
  }
  const mobileMax = Number.parseInt(String(chrome.viewport_breakpoint_mobile_max).trim(), 10);
  const tabletMax = Number.parseInt(String(chrome.viewport_breakpoint_tablet_max).trim(), 10);
  if (
    !(
      Number.isFinite(mobileMax) &&
      mobileMax > 0 &&
      Number.isFinite(tabletMax) &&
      tabletMax > mobileMax
    )
  ) {
    return false;
  }
  const tol = Number.parseFloat(String(chrome.viewport_aspect_tolerance).trim());
  const maxBytes = Number.parseInt(String(chrome.viewport_max_video_bytes).trim(), 10);
  return Number.isFinite(tol) && tol > 0 && tol <= 1 && Number.isFinite(maxBytes) && maxBytes >= 1;
}

/** Fail closed: campaign thumbnail/gallery upload chrome from ad_runtime_chrome. */
export function isAdMediaChromeReady(
  chrome: AdScheduleChrome | null | undefined,
): chrome is AdScheduleChrome &
  Required<Pick<AdScheduleChrome, (typeof AD_MEDIA_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  return AD_MEDIA_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Fail closed: Leaflet map pin chrome from ad_runtime_chrome. */
export function isAdMapChromeReady(
  chrome: AdScheduleChrome | null | undefined,
): chrome is AdScheduleChrome &
  Required<Pick<AdScheduleChrome, (typeof AD_MAP_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  return AD_MAP_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export type AdPlayback = {
  non_skippable_seconds: number;
  first_show_after_game_seconds: number;
  default_interval_seconds: number;
  non_skippable_min: number;
  non_skippable_max: number;
  first_show_min: number;
  first_show_max: number;
  interval_min: number;
  interval_max: number;
  impression_cap_min: number;
  player_chrome: AdPlayerChrome;
  schedule_chrome: AdScheduleChrome;
};

export type InMatchEligibilityRequest = {
  game_elapsed_seconds: number;
  seconds_since_last_ad?: number | null;
  viewer_key: string;
  country: string;
  region?: string;
  district?: string;
  lat?: number;
  lng?: number;
};

export type InMatchCampaign = {
  id: string;
  title: string;
  creative_type?: string;
  creative_url?: string;
  video_id?: string;
  creative_desktop_url?: string;
  creative_tablet_url?: string;
  creative_mobile_url?: string;
  video_id_desktop?: string;
  video_id_tablet?: string;
  video_id_mobile?: string;
};

export type InMatchEligibilityResponse = {
  show: boolean;
  reason?: string;
  campaign?: InMatchCampaign;
  non_skippable_seconds: number;
  interval_seconds: number;
  first_show_after_seconds: number;
  next_check_after_seconds?: number;
};
