import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";

export type HostedEventConsoleRow = {
  id: string;
  title: string;
  description?: string;
  status: string;
  status_label?: string;
  join_code: string;
  visibility?: string;
  visibility_label?: string;
  /** null/omitted = Unlimited open enroll. */
  max_players?: number | null;
  /** API: null Unlimited or high Arena safety ceiling. */
  seat_cap_unlimited?: boolean;
  approved_count?: number;
  pending_count?: number;
  organizer_id?: string;
  organizer_username?: string;
  organizer_phone_kyc_verified?: boolean;
  organizer_document_kyc_verified?: boolean;
  organizer_host_trust_tier?: string;
  organizer_host_trust_badge?: string;
  organizer_finished_paid_cups?: number;
  organizer_cancelled_paid_cups?: number;
  organizer_open_reports?: number;
  created_at?: string;
  updated_at?: string;
  started_at?: string;
  finished_at?: string;
  cancelled_at?: string;
  format_id?: string;
  format_label?: string;
  size_id?: string;
  size_label?: string;
  is_free_entry?: boolean;
  entry_fee_amount?: number;
  entry_fee_currency?: string;
  entry_fee_commission_percent?: number;
  host_fee_amount?: number;
  host_fee_currency?: string;
  auto_approve?: boolean;
  share_url?: string;
  sponsor_name?: string;
  logo_url?: string;
  sponsor_logo_url?: string;
  prize_image_url?: string;
  gallery?: string[];
  brand_color?: string;
  winner_id?: string;
  /** Username label from API when resolved; never display raw winner_id. */
  winner_username?: string;
  prize_pool_display_enabled?: boolean;
  prize_pool_guarantee_enabled?: boolean;
  prize_pool_guarantee_held?: boolean;
  prize_pool_guarantee_captured?: boolean;
  prize_pool_guarantee_amount?: number;
  prize_pool_currency?: string;
  prize_pool_frozen?: boolean;
  prize_pool_now?: number;
  prize_pool_if_full?: number;
  prize_pool_frozen_at?: string;
};

export type HostedEventsConsoleListResponse = {
  events: HostedEventConsoleRow[];
  meta?: SkipPaginationMeta;
};
