import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

export type EventsCatalogFormat = {
  id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

export type EventsCatalogSize = {
  id: string;
  label: string;
  enabled: boolean;
  sort_order: number;
  /** null/omitted = Unlimited open enroll (Arena). */
  max_players?: number | null;
  /** Geo-resolved fee shown to the organizer (Ethiopia or global). */
  host_fee_amount: number;
  /** Server-computed geo base * public_host_fee_multiplier for create UI. */
  public_host_fee_amount?: number;
  host_fee_currency: string;
  allowed_format_ids: string[];
};

export type EntryFeeQuote = {
  amount: number;
  commission_percent: number;
  commission: number;
  organizer_net: number;
};

export type EventsCatalog = {
  formats: EventsCatalogFormat[];
  sizes: EventsCatalogSize[];
  auto_approve_default: boolean;
  force_auto_approve?: boolean;
  default_visibility?: string;
  report_reason_codes?: string[];
  report_reason_labels?: Record<string, string>;
  public_host_fee_multiplier?: number;
  entry_fee_commission_percent?: number;
  hosted_event_visibilities?: string[];
  hosted_event_public_visibility?: string;
  hosted_event_private_visibility?: string;
  hosted_event_phase_knockout?: string;
  hosted_event_phase_round_robin?: string;
  hosted_event_phase_swiss?: string;
  hosted_event_phase_group?: string;
  hosted_event_knockout_format?: string;
  hosted_event_round_robin_format?: string;
  hosted_event_swiss_format?: string;
  hosted_event_groups_knockout_format?: string;
  hosted_event_arena_format?: string;
  hosted_event_entry_statuses?: string[];
  hosted_event_entry_pending?: string;
  hosted_event_entry_approved?: string;
  hosted_event_entry_rejected?: string;
  hosted_event_entry_kicked?: string;
  /** Master gate for Community browse + Host CTA (create community tournament). */
  hosted_events_enabled?: boolean;
  public_events_enabled?: boolean;
  public_event_matches_rated?: boolean;
  prize_pool_display_enabled?: boolean;
  prize_pool_guarantee_enabled?: boolean;
  hosted_event_default_status?: string;
  min_players_to_start: Record<string, number>;
  share_path_template: string;
  swiss_rounds_by_max_players?: Record<string, number>;
  groups_knockout_target_group_size?: number;
  groups_knockout_advance_per_group?: number;
};

export type HostedEvent = {
  id: string;
  organizer_id: string;
  title: string;
  format_id: string;
  format_label?: string;
  size_id: string;
  size_label?: string;
  /** Omitted or null = Unlimited open enroll. */
  max_players?: number | null;
  /** API: null Unlimited or high safety ceiling (Arena). */
  seat_cap_unlimited?: boolean;
  host_fee_amount: number;
  host_fee_currency: string;
  host_paid_at?: string;
  entry_fee_amount: number;
  entry_fee_currency: string;
  entry_fee_commission_percent?: number;
  is_free_entry: boolean;
  auto_approve: boolean;
  visibility: string;
  /** DB label from client_enums.hosted_event_visibility_labels. */
  visibility_label?: string;
  join_code: string;
  status: string;
  /** DB label from client_enums.hosted_event_status_labels; fail-closed UI uses empty_value when missing. */
  status_label?: string;
  approved_count?: number;
  pending_count?: number;
  description?: string;
  logo_url?: string;
  brand_color?: string;
  sponsor_logo_url?: string;
  sponsor_name?: string;
  prize_image_url?: string | null;
  gallery?: string[];
  winner_id?: string;
  check_in_opens_at?: string | null;
  check_in_closes_at?: string | null;
  prize_settled_at?: string | null;
  dispute_window_ends_at?: string | null;
  arena_ends_at?: string | null;
  arena_duration_minutes?: number | null;
  started_at?: string;
  finished_at?: string;
  /** Unfinished live bracket board - Watch deep-link (omit when none). */
  live_game_id?: string | null;
  cancelled_at?: string;
  share_url?: string;
  created_at?: string;
  updated_at?: string;
  prize_pool_display_enabled?: boolean;
  prize_pool_guarantee_enabled?: boolean;
  prize_pool_guarantee_amount?: number;
  prize_pool_guarantee_held?: boolean;
  prize_pool_guarantee_captured?: boolean;
  prize_pool_now?: number;
  prize_pool_if_full?: number;
  prize_pool_frozen?: boolean;
  prize_pool_currency?: string;
  prize_payout_mode?: string;
  prize_place_percents?: Record<string, number>;
  /** Public host presence from MapOrganizerPublicCards (omit when API skipped). */
  organizer_username?: string;
  organizer_avatar_url?: string;
  /** Omitted when API skipped rating (never invent 0). */
  organizer_rating?: number;
  organizer_phone_kyc_verified?: boolean;
  organizer_document_kyc_verified?: boolean;
  /** DB-driven host trust tier code (unverified / phone_verified / document_verified). */
  organizer_host_trust_tier?: string;
  /** Server-resolved badge label for lobby cards. */
  organizer_host_trust_badge?: string;
  organizer_finished_paid_cups?: number;
  organizer_cancelled_paid_cups?: number;
  organizer_open_reports?: number;
  viewer_arena_queued?: boolean;
};

export type HostedEventEntry = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  /** DB label from client_enums.hosted_event_entry_status_labels. */
  status_label?: string;
  seed?: number | null;
  eliminated: boolean;
  placement?: number | null;
  fee_paid: number;
  platform_commission?: number;
  organizer_net?: number;
  fee_currency: string;
  joined_at: string;
  checked_in_at?: string | null;
  decided_at?: string | null;
  username?: string;
  rating?: number;
};

export type HostedBracketMatch = {
  id: string;
  event_id: string;
  /** DB phase code (group / knockout / swiss / round_robin); empty on legacy rows. */
  phase?: string;
  /** Group index within phase; -1 when not in a group stage. */
  group_index?: number;
  round_index: number;
  match_index: number;
  player_a_id?: string | null;
  player_b_id?: string | null;
  winner_id?: string | null;
  /** DB usernames from ListBracket JOIN; UI must not show raw UUIDs. */
  player_a_username?: string;
  player_b_username?: string;
  winner_username?: string;
  next_match_id?: string | null;
  next_slot?: string | null;
  game_id?: string | null;
  status: string;
  status_label?: string;
  is_bye: boolean;
  player_a_ready_at?: string | null;
  player_b_ready_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Computed standings from GET /events/{id}/standings. */
export type HostedStandingRow = {
  user_id: string;
  username?: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  group_index?: number;
  placement?: number | null;
};

export type EventsDashboard = {
  active_count: number;
  upcoming_count: number;
  players_joined_this_week: number;
  officially_paused_count?: number;
  official_pause_avg_seconds?: number;
  host_fee_revenue_sum: number;
  host_fee_currency?: string;
  entry_fee_revenue_sum: number;
  entry_fee_net_sum?: number;
  entry_fee_gross_sum?: number;
  entry_fee_commission_sum?: number;
  entry_fee_currency?: string;
  host_trust_tier?: string;
  host_trust_badge?: string;
  host_finished_paid_cups?: number;
  host_cancelled_paid_cups?: number;
  host_open_reports?: number;
  last_event_id?: string;
  last_event_join_code?: string;
  last_event_share_url?: string;
};

export type EventsAnalyticsRow = {
  event_id: string;
  title: string;
  status: string;
  status_label?: string;
  join_code: string;
  players_joined: number;
  started: boolean;
  finished: boolean;
  host_fee: number;
  host_fee_currency: string;
  entry_fees_sum: number;
  entry_commission_sum?: number;
  entry_net_sum?: number;
  entry_fee_currency: string;
  share_url?: string;
};

export type EventsAnalytics = {
  metrics: string[];
  share_clicks_tracked: boolean;
  events: EventsAnalyticsRow[];
  totals: {
    players_joined: number;
    events_started: number;
    events_finished: number;
    host_fee_sum: number;
    host_fee_currency?: string;
    entry_fees_sum: number;
    entry_commission_sum?: number;
    entry_net_sum?: number;
    entry_fee_currency?: string;
  };
};

export type EventsListResponse = {
  events: HostedEvent[];
  meta: SkipPaginationMeta;
};

export type CreateHostedEventInput = {
  title: string;
  description?: string;
  format_id: string;
  size_id: string;
  visibility?: string;
  is_free_entry?: boolean;
  entry_fee_amount?: number;
  entry_fee_currency?: string;
  brand_color?: string;
  country_code?: string;
  prize_pool_display_enabled?: boolean;
  prize_pool_guarantee_enabled?: boolean;
  prize_pool_guarantee_amount?: number;
  arena_duration_minutes?: number;
  prize_payout_mode?: string;
  prize_place_percents?: Record<string, number>;
};

export type PatchHostedEventInput = {
  title?: string;
  description?: string;
  visibility?: string;
  brand_color?: string;
  sponsor_name?: string;
  prize_payout_mode?: string;
  prize_place_percents?: Record<string, number>;
};

export type ReportHostedEventInput = {
  reason_code: string;
  note?: string;
};

export type HostedEventReport = {
  id: string;
  event_id: string;
  reporter_id: string;
  reason_code: string;
  note: string;
  status: string;
  created_at?: string;
};

export type JoinHostedEventInput = {
  code: string;
  country_code?: string;
};

export type JoinHostedEventResult = {
  entry: HostedEventEntry;
  event: HostedEvent;
};
