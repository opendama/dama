import type { ConsoleFeatureFlagsQuery } from "@/gql/graphql";

/** GraphQL `consoleFeatureFlags` selection (codegen). */
export type ConsoleFeatureFlags = ConsoleFeatureFlagsQuery["consoleFeatureFlags"];

export type XPLevel = { min_xp: number; label: string };

/** PvP career deltas + floors from platform_settings.match_rewards (VS-AI never applies deltas). */
export type MatchRewardsConfig = {
  win_xp: number;
  draw_xp: number;
  loss_xp: number;
  win_rating: number;
  draw_rating: number;
  loss_rating: number;
  /** Admin-owned minimum profile rating after career deltas (may be 0). */
  rating_floor: number;
  /** Assigned on brand-new OAuth accounts only; must be >= rating_floor. */
  starting_rating: number;
};

export type ProgressionPayload = {
  xp_levels: XPLevel[];
  match_clock: {
    enabled: boolean;
    initial_seconds: number;
    increment_seconds: number;
    invite_ttl_seconds: number;
    pause_enabled: boolean;
    pause_duration_seconds: number;
    presets?: { seconds: number; label: string }[];
  };
  match_rewards: MatchRewardsConfig;
  ad_pricing: {
    impression_unit_cost: number;
    campaign_create_fee_ethiopia_amount: number;
    campaign_create_fee_ethiopia_currency: string;
    campaign_create_fee_global_amount: number;
    campaign_create_fee_global_currency: string;
  };
  /** Absolute player web origin for challenge/share deep links (may be empty until set). */
  web_app_origin?: string;
};

export type BoardRules = {
  size: number;
  pieces_per_side: number;
  setup_rows: number;
  variant: string;
};

export type PaymentCurrencyConfig = {
  global: string;
  ethiopia: string;
  supported: string[];
};

export type FeatureFlags = {
  vs_ai_enabled: boolean;
  otp_required?: boolean;
  ai_depths?: number[];
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
  campaign_status_labels?: Record<string, string>;
  tournament_status_labels?: Record<string, string>;
  creative_type_labels?: Record<string, string>;
  hosted_event_report_status_labels?: Record<string, string>;
  hosted_event_visibility_labels?: Record<string, string>;
  hosted_event_status_labels?: Record<string, string>;
  hosted_event_public_visibility?: string;
  hosted_event_private_visibility?: string;
  hosted_event_report_open_status?: string;
  hosted_event_report_dismissed_status?: string;
  hosted_event_report_deactivated_status?: string;
  hosted_event_report_statuses?: string[];
  creative_types: string[];
  default_creative_type: string;
  video_creative_type: string;
  default_tournament_status: string;
  default_campaign_status: string;
  enrollable_tournament_status: string;
  servable_campaign_status: string;
  archived_campaign_status?: string;
  reopen_campaign_status?: string;
  ethiopia_payment_modes: EthiopiaPaymentModeOption[];
  tournament_bracket_ready?: string;
  tournament_bracket_live?: string;
  tournament_formats?: string[];
  tournament_default_format?: string;
  competition_prize_auto_settle?: string;
  competition_dispute_window_hours?: string;
  competition_prize_settle_interval_minutes?: string;
  competition_check_in_window_hours?: string;
  competition_match_ready_timeout_seconds?: string;
  competition_match_ready_auto_forfeit?: string;
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
  competition_standings_points_win?: string;
  competition_standings_points_draw?: string;
  unavailable: string;
};

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
  cash_rmg_flag_key: string;
};

export type PublicPlayerResponse = {
  player: {
    id: string;
    username: string;
    rating: number;
    xp: number;
    wins: number;
    losses: number;
    draws?: number;
    region?: string | null;
    country_code?: string | null;
    avatar_thumb_url?: string | null;
    avatar_full_url?: string | null;
  };
  matches: Array<{
    id: string;
    mode?: string;
    is_draw?: boolean;
    winner_id?: string | null;
    finished_at?: string | null;
  }>;
  regional_rank: number;
  region_label: string;
};
