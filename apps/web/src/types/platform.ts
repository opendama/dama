import type { FeatureFlagsQuery } from "@/gql/graphql";

export type FeatureFlags = {
  vs_ai_enabled: boolean;
  otp_required?: boolean;
  cash_rmg_enabled?: boolean;
  cash_phone_kyc_required?: boolean;
  /** Default true (OTP required) when omitted - fail closed. */
  cash_phone_otp_required?: boolean;
  cash_rmg_disabled_countries?: string[];
  hosted_events_enabled?: boolean;
  public_events_enabled?: boolean;
  public_event_matches_rated?: boolean;
  prize_pool_display_enabled?: boolean;
  prize_pool_guarantee_enabled?: boolean;
  /** Admin document-KYC auto-approve (server-enforced; exposed for console/WS parity). */
  kyc_auto_approve?: boolean;
  ai_depths?: number[];
};

/** GraphQL `featureFlags` selection (codegen). */
export type GraphqlFeatureFlags = FeatureFlagsQuery["featureFlags"];

export type MatchClockPreset = {
  seconds: number;
  label: string;
};

export type ProgressionConfig = {
  xp_levels: Array<{ min_xp: number; label: string }>;
  match_clock: {
    enabled: boolean;
    initial_seconds: number;
    increment_seconds: number;
    presets?: MatchClockPreset[];
    /** Pending invite / challenge-link lifetime (seconds) from DB. */
    invite_ttl_seconds?: number;
    /** Admin Progression: seated players may freeze the match. */
    pause_enabled?: boolean;
    /** Admin Progression: max pause length in seconds. */
    pause_duration_seconds?: number;
  };
};

export type EthiopiaPaymentModeOption = {
  mode: string;
  label: string;
  enabled: boolean;
};

export type ClientEnums = {
  roles: string[];
  console_roles: string[];
  publisher_roles: string[];
  default_role: string;
  tournament_statuses: string[];
  campaign_statuses: string[];
  creative_types: string[];
  default_creative_type: string;
  video_creative_type: string;
  default_tournament_status: string;
  default_campaign_status: string;
  enrollable_tournament_status: string;
  servable_campaign_status: string;
  archived_campaign_status: string;
  reopen_campaign_status: string;
  ethiopia_payment_modes: EthiopiaPaymentModeOption[];
  hosted_event_statuses?: string[];
  hosted_event_joinable_statuses?: string[];
  /** Status that allows title patch (server: HostedEventDefaultStatus). */
  hosted_event_default_status?: string;
  hosted_event_visibilities?: string[];
  hosted_event_default_visibility?: string;
  hosted_event_public_visibility?: string;
  hosted_event_private_visibility?: string;
  hosted_event_phase_knockout?: string;
  hosted_event_phase_round_robin?: string;
  hosted_event_phase_swiss?: string;
  hosted_event_phase_group?: string;
  hosted_event_arena_format?: string;
  hosted_event_phase_arena?: string;
  competition_arena_points_win?: string;
  competition_arena_points_draw?: string;
  competition_arena_points_loss?: string;
  competition_arena_streak_second_win?: string;
  competition_arena_streak_third_plus_win?: string;
  competition_arena_default_duration_minutes?: string;
  competition_arena_pairing_modes?: string[];
  competition_arena_default_pairing_mode?: string;
  competition_arena_auto_start?: string;
  competition_arena_pair_interval_seconds?: string;
  competition_arena_allow_join_while_live?: string;
  hosted_event_knockout_format?: string;
  hosted_event_round_robin_format?: string;
  hosted_event_swiss_format?: string;
  hosted_event_groups_knockout_format?: string;
  competition_payout_modes?: string[];
  competition_payout_mode_places_percent?: string;
  competition_payout_mode_score_share?: string;
  competition_payout_mode_dual_purse?: string;
  competition_dual_purse_place_percent?: string;
  competition_default_payout_mode_knockout?: string;
  competition_default_payout_mode_round_robin?: string;
  competition_default_payout_mode_swiss?: string;
  competition_default_payout_mode_groups_knockout?: string;
  competition_default_payout_mode_arena?: string;
  competition_default_place_percent_1?: string;
  competition_default_place_percent_2?: string;
  competition_default_place_percent_3?: string;
  hosted_event_report_open_status?: string;
  hosted_event_report_dismissed_status?: string;
  hosted_event_report_deactivated_status?: string;
  hosted_event_entry_statuses?: string[];
  hosted_event_entry_pending?: string;
  hosted_event_entry_approved?: string;
  hosted_event_entry_rejected?: string;
  hosted_event_entry_kicked?: string;
  hosted_event_bracket_statuses?: string[];
  hosted_event_bracket_pending?: string;
  hosted_event_bracket_ready?: string;
  hosted_event_bracket_live?: string;
  hosted_event_bracket_done?: string;
  hosted_event_bracket_bye?: string;
  hosted_event_full_status?: string;
  hosted_event_live_status?: string;
  hosted_event_finished_status?: string;
  hosted_event_cancelled_status?: string;
  hosted_event_status_labels?: Record<string, string>;
  hosted_event_entry_status_labels?: Record<string, string>;
  hosted_event_bracket_status_labels?: Record<string, string>;
  hosted_event_report_status_labels?: Record<string, string>;
  hosted_event_visibility_labels?: Record<string, string>;
  campaign_status_labels?: Record<string, string>;
  tournament_status_labels?: Record<string, string>;
  creative_type_labels?: Record<string, string>;
  unavailable: string;
};

export type ClientNavLink = {
  title: string;
  href?: string;
  route_key: string;
  body?: string;
  body_when_vs_ai?: string;
  cta?: string;
};

/** Bottom nav groups from client_nav.bottom_nav (DB only). */
export type ClientNavBottomNav = {
  player?: ClientNavLink[];
  mobile?: ClientNavLink[];
  ads?: ClientNavLink[];
  events?: ClientNavLink[];
};

/** Player dashboard panel card hydrated from client_nav.dashboard. */
export type DashboardPanelProps = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

export type ClientNavSurface = "player" | "ads" | "events" | "marketing" | "mobile" | "dashboard";

export type ClientNavPayload = Record<ClientNavSurface, ClientNavLink[]> & {
  bottom_nav?: ClientNavBottomNav;
  mobile_nav_unavailable?: string;
  brand_name?: string;
  ads_brand_name?: string;
  events_brand_name?: string;
  marketing_hero_eyebrow?: string;
  marketing_hero_blurb?: string;
  marketing_footer_text?: string;
  site_title_default?: string;
  site_title_template?: string;
  site_description?: string;
  graphql_empty?: string;
  dashboard_page_title?: string;
  dashboard_page_blurb?: string;
  profile_load_failed?: string;
  dashboard_unavailable?: string;
  dashboard_history_title?: string;
  dashboard_history_empty?: string;
  dashboard_history_unavailable?: string;
  dashboard_profile_action?: string;
  dashboard_profile_href?: string;
  dashboard_play_action?: string;
  dashboard_play_href?: string;
  dashboard_win_rate_label?: string;
  dashboard_percent_suffix?: string;
  dashboard_matches_suffix?: string;
  dashboard_matches_joiner?: string;
  dashboard_recent_results_title?: string;
  dashboard_transactions_action?: string;
  dashboard_transactions_href?: string;
  dashboard_find_match_action?: string;
  dashboard_wallet_href?: string;
  dashboard_col_result?: string;
  dashboard_col_mode?: string;
  dashboard_col_moves?: string;
  dashboard_col_date?: string;
  settings_session_label?: string;
  settings_unavailable?: string;
};

function bottomNavLinksReady(links: ClientNavLink[] | undefined): boolean {
  if (!links || links.length === 0) return false;
  return links.every(
    (item) =>
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      typeof item.route_key === "string" &&
      item.route_key.trim().length > 0 &&
      typeof item.href === "string" &&
      item.href.trim().length > 0,
  );
}

/** Fail closed: bottom_nav.player ready for player mobile bar. */
export function isPlayerBottomNavReady(nav: ClientNavPayload | null | undefined): boolean {
  return bottomNavLinksReady(nav?.bottom_nav?.player);
}

/** Fail closed: bottom_nav.ads ready for ads mobile bar. */
export function isAdsBottomNavReady(nav: ClientNavPayload | null | undefined): boolean {
  return bottomNavLinksReady(nav?.bottom_nav?.ads);
}

/** Fail closed: bottom_nav.events ready for events mobile bar. */
export function isEventsBottomNavReady(nav: ClientNavPayload | null | undefined): boolean {
  return bottomNavLinksReady(nav?.bottom_nav?.events);
}

const CLIENT_NAV_CHROME_KEYS = [
  "brand_name",
  "ads_brand_name",
  "events_brand_name",
  "marketing_hero_eyebrow",
  "marketing_hero_blurb",
  "marketing_footer_text",
  "site_title_default",
  "site_title_template",
  "site_description",
  "graphql_empty",
  "dashboard_page_title",
  "dashboard_page_blurb",
  "profile_load_failed",
  "dashboard_unavailable",
  "dashboard_history_title",
  "dashboard_history_empty",
  "dashboard_history_unavailable",
  "dashboard_profile_action",
  "dashboard_profile_href",
  "dashboard_play_action",
  "dashboard_play_href",
  "dashboard_win_rate_label",
  "dashboard_percent_suffix",
  "dashboard_matches_suffix",
  "dashboard_matches_joiner",
  "dashboard_recent_results_title",
  "dashboard_transactions_action",
  "dashboard_transactions_href",
  "dashboard_find_match_action",
  "dashboard_wallet_href",
  "dashboard_col_result",
  "dashboard_col_mode",
  "dashboard_col_moves",
  "dashboard_col_date",
  "settings_session_label",
  "settings_unavailable",
] as const;

/** Fail closed: player dashboard + brand/site chrome from client_nav. */
export function isPlayerDashboardChromeReady(
  nav: ClientNavPayload | null | undefined,
): nav is Required<ClientNavPayload> {
  if (!nav) return false;
  return CLIENT_NAV_CHROME_KEYS.every((k) => {
    const v = nav[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Fail closed: marketing hero/footer chrome from client_nav. */
export function isMarketingChromeReady(
  nav: ClientNavPayload | null | undefined,
): nav is Required<ClientNavPayload> {
  if (!nav) return false;
  const required = [
    nav.brand_name,
    nav.marketing_hero_eyebrow,
    nav.marketing_hero_blurb,
    nav.marketing_footer_text,
  ];
  return required.every((v) => typeof v === "string" && v.trim().length > 0);
}

export type FeatureFlagToggle = {
  key: string;
  title: string;
  description: string;
  kind: "boolean" | "mode" | string;
  state_field?: string;
};

export type FeatureFlagCatalog = {
  toggles: FeatureFlagToggle[];
  ai_depths_flag_key: string;
};
