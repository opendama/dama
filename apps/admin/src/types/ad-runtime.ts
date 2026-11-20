import { viewportAspectRatioFromLabel } from "@/lib/resolve-viewport-creative";

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
  console_campaigns_limit: number;
};

/** Writable platform playback fields (bounds stay DB-owned). */
export type AdPlaybackUpdatePayload = Pick<
  AdPlayback,
  "non_skippable_seconds" | "first_show_after_game_seconds" | "default_interval_seconds"
>;

export type AdRuntimeChrome = {
  section_title: string;
  page_body: string;
  non_skippable_label: string;
  first_show_label: string;
  interval_label: string;
  daily_cap_label: string;
  weekly_cap_label: string;
  monthly_cap_label: string;
  yearly_cap_label: string;
  schedule_enabled_label: string;
  status_label: string;
  update_status_action: string;
  platform_default_placeholder: string;
  unlimited_cap_placeholder: string;
  campaigns_title: string;
  no_campaigns: string;
  load_campaigns_failed: string;
  lacks_permissions: string;
  save_action: string;
  save_pending: string;
  save_campaign_schedule_action: string;
  save_campaign_schedule_pending: string;
  update_status_pending: string;
  unavailable: string;
  playback_unavailable: string;
  toast_playback_saved: string;
  toast_schedule_saved: string;
  toast_status_updated: string;
  toast_save_failed: string;
  toast_update_failed: string;
  meta_separator: string;
  runtime_permission_key: string;
  campaigns_permission_key: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size: string;
  /** Empty cell / missing status label (DB only; never invent "-"). */
  empty_value?: string;
  search_campaigns_label?: string;
  search_campaigns_placeholder?: string;
  filter_status_label?: string;
  filter_status_all?: string;
  view_action?: string;
  edit_action?: string;
  row_actions_label?: string;
  dialog_close_label?: string;
  cancel_action?: string;
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  /** Discrete detail/column labels (not ph_* / *_prompt / *_suffix / campaigns_title). */
  daily_spend_cap_label?: string;
  video_id_label?: string;
  creative_url_label?: string;
  col_title?: string;
  created_at_label?: string;
  /** Optional discrete label; omit publisher_id UI when absent. */
  publisher_id_label?: string;
  publisher_stat_impressions?: string;
  publisher_stat_clicks?: string;
  stats_impressions_suffix?: string;
  stats_clicks_suffix?: string;
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
  thumbnail_upload_pending?: string;
  gallery_upload_pending?: string;
  toast_thumbnail_saved?: string;
  toast_gallery_saved?: string;
  media_upload_failed?: string;
  /** Optional until ad_runtime_chrome viewport keys are hydrated from DB. */
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
  viewport_breakpoint_mobile_max?: string;
  viewport_breakpoint_tablet_max?: string;
  viewport_aspect_tolerance?: string;
  viewport_max_video_bytes?: string;
  toast_viewport_creative_saved?: string;
  toast_viewport_creative_cleared?: string;
  toast_viewport_video_queued?: string;
  clear_legacy_video_action?: string;
  toast_legacy_video_cleared?: string;
};

export type ViewportCreativeSlot = "desktop" | "tablet" | "mobile";

const AD_RUNTIME_CONSOLE_PENDING_KEYS = [
  "save_pending",
  "save_campaign_schedule_pending",
  "update_status_pending",
] as const;

/** Ops table/filter chrome required by Go ReloadAdRuntimeChrome (match Go). */
const AD_RUNTIME_CONSOLE_OPS_KEYS = [
  "empty_value",
  "search_campaigns_label",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "row_actions_label",
  "view_action",
  "daily_spend_cap_label",
  "video_id_label",
  "creative_url_label",
  "col_title",
  "created_at_label",
] as const;

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
  "thumbnail_upload_pending",
  "gallery_upload_pending",
  "toast_thumbnail_saved",
  "toast_gallery_saved",
  "media_upload_failed",
] as const;

function adRuntimeFieldReady(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Fail closed: admin console save-button pending labels from ad_runtime_chrome. */
export function isAdRuntimeConsolePendingReady(
  chrome: AdRuntimeChrome | null | undefined,
): chrome is AdRuntimeChrome &
  Required<Pick<AdRuntimeChrome, (typeof AD_RUNTIME_CONSOLE_PENDING_KEYS)[number]>> {
  if (!chrome) return false;
  return AD_RUNTIME_CONSOLE_PENDING_KEYS.every((k) => adRuntimeFieldReady(chrome[k]));
}

/** Fail closed: console campaigns table/filter chrome (match Go required keys). */
export function isAdRuntimeConsoleOpsReady(
  chrome: AdRuntimeChrome | null | undefined,
): chrome is AdRuntimeChrome &
  Required<Pick<AdRuntimeChrome, (typeof AD_RUNTIME_CONSOLE_OPS_KEYS)[number]>> {
  if (!chrome) return false;
  return AD_RUNTIME_CONSOLE_OPS_KEYS.every((k) => adRuntimeFieldReady(chrome[k]));
}

/** Fail closed: pending + ops console chrome for ads admin surfaces. */
export function isAdRuntimeConsoleReady(
  chrome: AdRuntimeChrome | null | undefined,
): chrome is AdRuntimeChrome &
  Required<
    Pick<
      AdRuntimeChrome,
      | (typeof AD_RUNTIME_CONSOLE_PENDING_KEYS)[number]
      | (typeof AD_RUNTIME_CONSOLE_OPS_KEYS)[number]
    >
  > {
  return isAdRuntimeConsolePendingReady(chrome) && isAdRuntimeConsoleOpsReady(chrome);
}

/** Fail closed: campaign thumbnail/gallery upload chrome from ad_runtime_chrome. */
export function isAdMediaChromeReady(
  chrome: AdRuntimeChrome | null | undefined,
): chrome is AdRuntimeChrome &
  Required<Pick<AdRuntimeChrome, (typeof AD_MEDIA_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  return AD_MEDIA_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

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
  chrome: AdRuntimeChrome | null | undefined,
): chrome is AdRuntimeChrome &
  Required<Pick<AdRuntimeChrome, (typeof VIEWPORT_CREATIVES_CHROME_KEYS)[number]>> {
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

export type AdPlaybackConsolePayload = {
  playback: AdPlayback;
  chrome: AdRuntimeChrome;
};

export type ConsoleAdCampaign = {
  id: string;
  publisher_id: string;
  title: string;
  status: string;
  status_label?: string;
  daily_spend_cap?: number | null;
  creative_type: string;
  creative_type_label?: string;
  creative_url?: string;
  video_id?: string;
  creative_desktop_url?: string;
  creative_tablet_url?: string;
  creative_mobile_url?: string;
  video_id_desktop?: string;
  video_id_tablet?: string;
  video_id_mobile?: string;
  thumbnail_url?: string | null;
  gallery?: string[];
  auto_closed?: boolean;
  ends_at?: string | null;
  closed_at?: string | null;
  impressions: number;
  clicks: number;
  schedule_enabled: boolean;
  first_show_after_seconds?: number | null;
  interval_seconds?: number | null;
  non_skippable_seconds?: number | null;
  daily_impression_cap?: number | null;
  weekly_impression_cap?: number | null;
  monthly_impression_cap?: number | null;
  yearly_impression_cap?: number | null;
  created_at: string;
};

export type AdPlaybackBounds = {
  non_skippable_min: number;
  non_skippable_max: number;
  first_show_min: number;
  first_show_max: number;
  interval_min: number;
  interval_max: number;
  impression_cap_min: number;
};

export type ConsoleAdCampaignsPayload = {
  campaigns: ConsoleAdCampaign[];
  chrome: AdRuntimeChrome;
  bounds: AdPlaybackBounds;
  meta?: import("@/components/ui/skip-pagination").SkipPaginationMeta;
};
