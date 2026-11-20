export type TournamentPrizePool = {
  total?: number;
  currency?: string;
  [key: string]: unknown;
};

export type Tournament = {
  id: string;
  title: string;
  description?: string;
  is_free: boolean;
  entry_fee_amount: number;
  entry_fee_currency: string;
  prize_pool?: TournamentPrizePool;
  prize_image_url?: string | null;
  gallery?: string[];
  players_count?: number;
  status: string;
  /** DB label from client_enums.tournament_status_labels when available. */
  status_label?: string;
  /** Catalog format id: knockout | round_robin | swiss | groups_knockout. */
  format_id?: string;
  /** Catalog format label when stamped by API (never invent from id). */
  format_label?: string;
  /** Omitted or null when Arena Unlimited (no seat cap). */
  max_players?: number | null;
  /** API: null Unlimited or high safety ceiling (Arena). */
  seat_cap_unlimited?: boolean;
  prize_pool_display_enabled?: boolean;
  prize_pool_now?: number;
  prize_pool_if_full?: number;
  prize_pool_guarantee_amount?: number;
  prize_pool_frozen?: boolean;
  prize_pool_currency?: string;
  prize_payout_mode?: string;
  prize_place_percents?: Record<string, number>;
  /** True when the authenticated viewer already has a tournament_entries row. */
  viewer_enrolled?: boolean;
  /** Present when Bearer viewer has a tournament_entries row (list mine / enrolled). */
  viewer_placement?: number | null;
  viewer_arena_points?: number;
  viewer_arena_streak?: number;
  viewer_prize_amount?: number;
  viewer_prize_currency?: string;
  viewer_arena_queued?: boolean;
  check_in_opens_at?: string | null;
  check_in_closes_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  /** Unfinished live bracket board - Watch deep-link (omit when none). */
  live_game_id?: string | null;
  winner_id?: string | null;
  prize_settled_at?: string | null;
  dispute_window_ends_at?: string | null;
  arena_ends_at?: string | null;
  arena_duration_minutes?: number | null;
};

export type ArenaStandingRow = {
  user_id: string;
  username?: string;
  arena_points: number;
  arena_streak: number;
  arena_best_streak: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  placement?: number | null;
};

export type TournamentReport = {
  id: string;
  tournament_id: string;
  reporter_id: string;
  reason_code: string;
  note: string;
  status: string;
  created_at?: string;
};

export type TournamentRosterEntry = {
  user_id: string;
  username?: string;
  checked_in_at?: string | null;
  joined_at: string;
  placement?: number | null;
};

export type TournamentBracketMatch = {
  id: string;
  tournament_id: string;
  phase?: string;
  group_index?: number;
  round_index: number;
  match_index: number;
  player_a_id?: string | null;
  player_b_id?: string | null;
  winner_id?: string | null;
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

export type TournamentDetailResponse = {
  tournament: Tournament;
};
