export type AdminUser = {
  id: string;
  username: string;
  email?: string;
  primary_phone?: string;
  role: string;
  is_active: boolean;
  rating?: number;
  xp?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  country_code?: string;
  region?: string;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  created_at?: string;
  phone_kyc_verified?: boolean;
  document_kyc_verified?: boolean;
  host_trust_tier?: string;
  host_trust_badge?: string;
  host_finished_paid_cups?: number;
  host_cancelled_paid_cups?: number;
  host_open_reports?: number;
};

export type AdminUserPayoutMethod = {
  id: string;
  provider: string;
  account_name?: string;
  phone?: string;
  updated_at?: string;
};

/** GET /console/users/{id} - User.Self() + optional payout_methods. */
export type AdminUserDetail = AdminUser & {
  age_verified?: boolean;
  phone_kyc_verified?: boolean;
  document_kyc_verified?: boolean;
  age_verified_at?: string;
  phone_kyc_verified_at?: string;
  document_kyc_verified_at?: string;
  date_of_birth?: string;
  payout_methods?: AdminUserPayoutMethod[];
};

export type AdminBank = {
  id: string;
  provider: string;
  label: string;
  account_name?: string;
  account_number?: string;
  mobile_code?: string;
  currency: string;
  is_active: boolean;
};

export type AdminReceipt = {
  id: string;
  user_id?: string;
  username?: string;
  email?: string;
  amount: number;
  currency: string;
  provider?: string;
  reference?: string;
  receipt_url?: string;
  /** Canonical review status (pending/approved/rejected). */
  status: string;
  /** UI/PDF display status - settled approved proofs stamp as paid. */
  display_status?: string;
  intent_id?: string;
  created_at?: string;
  reviewed_at?: string;
  first_party_pdf_href?: string;
};

export type ConsoleKycSubmission = {
  id: string;
  user_id: string;
  username?: string;
  document_type: string;
  legal_name: string;
  id_front_url: string;
  id_back_url?: string;
  selfie_url: string;
  status: string;
  review_note?: string;
  reviewed_at?: string;
  created_at?: string;
};

export type ConsolePayout = {
  id: string;
  user_id: string;
  username?: string;
  amount: number;
  currency: string;
  phone: string;
  provider: string;
  status: string;
  review_note?: string;
  reviewed_at?: string;
  created_at?: string;
};

export type ConsoleTransaction = {
  id: string;
  user_id: string;
  username?: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
  /** Linked manual-transfer proof image when this top-up has a payment receipt. */
  receipt_url?: string;
  /** Linked payment receipt id for View receipt navigation. */
  receipt_id?: string;
  /** Linked payment receipt display status (pending/paid/rejected) when receipt_id is set. */
  receipt_status?: string;
};

export type CashRmgPublicPolicy = {
  payout_statuses?: string[];
  default_payout_status?: string;
  approvable_payout_status?: string;
  approved_payout_status?: string;
  rejected_payout_status?: string;
  paid_payout_status?: string;
  document_kyc_types?: string[];
  document_kyc_statuses?: string[];
  document_kyc_draft_status?: string;
  document_kyc_pending_status?: string;
  document_kyc_approved_status?: string;
  document_kyc_rejected_status?: string;
  document_kyc_passport_type?: string;
};

export type CashRmgPublicChromeResponse = {
  chrome?: Record<string, string | undefined>;
  policy?: CashRmgPublicPolicy;
};

export type AvatarRow = {
  id: string;
  username: string;
  rating?: number;
  country_code?: string | null;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
};

export type MediaPoolChannel = {
  id: string;
  channel_id: string;
  label: string;
  is_active: boolean;
  sort_order?: number;
  daily_quota_limit?: number;
  uploads_today?: number;
  last_error?: string | null;
};

export type MediaPoolTestResult = {
  id: string;
  ready: boolean;
  error?: string;
  label?: string;
};

export type Fingerprint = {
  id: string;
  user_id: string;
  username?: string;
  fingerprint: string;
  platform?: string;
  user_agent?: string;
  ip_hint?: string;
  last_seen_at: string;
  created_at?: string;
};

export type GeoRow = {
  id: string;
  user_id?: string | null;
  username?: string | null;
  ip?: string;
  country_code?: string;
  region?: string;
  city?: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
};

export type AuditRow = {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  meta?: Record<string, unknown>;
  created_at?: string;
};

export type ModerationSettings = {
  provider: string;
  enabled: boolean;
};

export type ConsoleNavModule = {
  title: string;
  href: string;
  body: string;
};

export type ConsoleNavItem = {
  id: string;
  label: string;
  href: string;
};

export type ConsoleNavSection = {
  id: string;
  label: string;
  items: ConsoleNavItem[];
};

export type ConsoleNavPayload = {
  modules: ConsoleNavModule[];
  /** Trim-style accordion sections; when present, sidebar prefers sections over flat modules. */
  sections?: ConsoleNavSection[];
  brand_title?: string;
  title_template?: string;
  meta_description?: string;
  meta_separator?: string;
  graphql_empty?: string;
};
