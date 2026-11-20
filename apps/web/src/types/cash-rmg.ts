export type CashRmgChrome = {
  cash_rmg_unavailable?: string;
  age_gate_title?: string;
  age_gate_blurb?: string;
  age_gate_dob_label?: string;
  age_gate_submit_action?: string;
  age_gate_submit_pending?: string;
  age_gate_success?: string;
  age_gate_failed?: string;
  age_gate_too_young?: string;
  age_required_error?: string;
  jurisdiction_blocked_error?: string;
  cash_disabled_error?: string;
  locate_required_error?: string;
  locate_stale_error?: string;
  country_required_error?: string;
  phone_kyc_title?: string;
  phone_kyc_blurb?: string;
  phone_kyc_phone_label?: string;
  phone_kyc_save_action?: string;
  phone_kyc_start_otp_action?: string;
  phone_kyc_send_pending?: string;
  phone_kyc_verify_action?: string;
  phone_kyc_verify_pending?: string;
  phone_kyc_code_label?: string;
  /** Optional Trim-style OTP hint; not fail-closed so older DBs still boot. */
  phone_kyc_code_placeholder?: string;
  phone_kyc_success?: string;
  phone_kyc_failed?: string;
  phone_kyc_required_error?: string;
  eligible_label?: string;
  not_eligible_label?: string;
  doc_kyc_title?: string;
  doc_kyc_blurb?: string;
  doc_kyc_type_label?: string;
  doc_kyc_legal_name_label?: string;
  doc_kyc_front_label?: string;
  doc_kyc_back_label?: string;
  doc_kyc_selfie_label?: string;
  doc_kyc_upload_action?: string;
  doc_kyc_save_draft_action?: string;
  doc_kyc_submit_action?: string;
  doc_kyc_submit_pending?: string;
  doc_kyc_pending_label?: string;
  doc_kyc_approved_label?: string;
  doc_kyc_rejected_label?: string;
  doc_kyc_success?: string;
  doc_kyc_failed?: string;
  doc_kyc_required_error?: string;
  doc_kyc_incomplete_error?: string;
  doc_kyc_type_passport?: string;
  doc_kyc_type_national_id?: string;
  doc_kyc_type_drivers_license?: string;
  doc_kyc_camera_action?: string;
  doc_kyc_gallery_action?: string;
  host_trust_badge_unverified?: string;
  host_trust_badge_phone_verified?: string;
  host_trust_badge_document_verified?: string;
  doc_kyc_auto_approved_success?: string;
  /** Optional worldwide placeholders (not fail-closed). */
  doc_kyc_legal_name_placeholder?: string;
  age_gate_dob_placeholder?: string;
  phone_kyc_phone_placeholder?: string;
};

export type CashRmgPolicy = {
  min_age_years?: number;
  allowed_country_codes?: string[];
  locate_max_age_seconds?: number;
  require_locate_for_cash?: boolean;
  otp_phone_channel?: string;
  payout_statuses?: string[];
  default_payout_status?: string;
  approvable_payout_status?: string;
  approved_payout_status?: string;
  rejected_payout_status?: string;
  paid_payout_status?: string;
  require_document_kyc_for_payout?: boolean;
  host_guarantee_requires_document_kyc?: boolean;
  host_paid_create_requires_phone_kyc?: boolean;
  host_concurrent_open_paid_cap_phone_verified?: number;
  host_concurrent_open_paid_cap_document_verified?: number;
  host_concurrent_open_paid_cap_new_host?: number;
  host_new_host_settled_paid_threshold?: number;
  host_reputation_max_open_reports?: number;
  host_reputation_cancel_rate_bps?: number;
  host_reputation_cancel_rate_min_sample?: number;
  host_trust_tier_unverified?: string;
  host_trust_tier_phone_verified?: string;
  host_trust_tier_document_verified?: string;
  document_kyc_types?: string[];
  document_kyc_statuses?: string[];
  document_kyc_draft_status?: string;
  document_kyc_pending_status?: string;
  document_kyc_approved_status?: string;
  document_kyc_rejected_status?: string;
  document_kyc_passport_type?: string;
};

export type CashRmgPayload = {
  chrome?: CashRmgChrome;
  policy?: CashRmgPolicy;
};

export type CashEligibility = {
  ok?: boolean;
  error?: string;
  error_key?: string;
  country_code?: string;
  age_verified?: boolean;
  phone_kyc_verified?: boolean;
  /** Server HasApprovedDocument - payout gate (do not rely on KYC panel mount). */
  document_kyc_approved?: boolean;
  cash_rmg_enabled?: boolean;
  min_age_years?: number;
  /** Present when age is verified (ISO YYYY-MM-DD). */
  date_of_birth?: string;
  /** Present when phone KYC has a saved number. */
  primary_phone?: string;
};

/** Fail-closed chrome only. Placeholders (*_placeholder) stay optional for older DBs. */
const CHROME_KEYS: (keyof CashRmgChrome)[] = [
  "cash_rmg_unavailable",
  "age_gate_title",
  "age_gate_blurb",
  "age_gate_dob_label",
  "age_gate_submit_action",
  "age_gate_submit_pending",
  "age_gate_success",
  "age_gate_failed",
  "age_gate_too_young",
  "age_required_error",
  "jurisdiction_blocked_error",
  "cash_disabled_error",
  "locate_required_error",
  "locate_stale_error",
  "country_required_error",
  "phone_kyc_title",
  "phone_kyc_blurb",
  "phone_kyc_phone_label",
  "phone_kyc_save_action",
  "phone_kyc_start_otp_action",
  "phone_kyc_send_pending",
  "phone_kyc_verify_action",
  "phone_kyc_verify_pending",
  "phone_kyc_code_label",
  "phone_kyc_success",
  "phone_kyc_failed",
  "phone_kyc_required_error",
  "eligible_label",
  "not_eligible_label",
  "doc_kyc_title",
  "doc_kyc_blurb",
  "doc_kyc_type_label",
  "doc_kyc_legal_name_label",
  "doc_kyc_front_label",
  "doc_kyc_back_label",
  "doc_kyc_selfie_label",
  "doc_kyc_upload_action",
  "doc_kyc_save_draft_action",
  "doc_kyc_submit_action",
  "doc_kyc_submit_pending",
  "doc_kyc_pending_label",
  "doc_kyc_approved_label",
  "doc_kyc_rejected_label",
  "doc_kyc_success",
  "doc_kyc_failed",
  "doc_kyc_required_error",
  "doc_kyc_incomplete_error",
  "doc_kyc_type_passport",
  "doc_kyc_type_national_id",
  "doc_kyc_type_drivers_license",
  "doc_kyc_camera_action",
  "doc_kyc_gallery_action",
  "host_trust_badge_unverified",
  "host_trust_badge_phone_verified",
  "host_trust_badge_document_verified",
  "doc_kyc_auto_approved_success",
];

export function isCashRmgChromeReady(data: CashRmgPayload | undefined): data is Required<
  Pick<CashRmgPayload, "chrome" | "policy">
> & {
  chrome: Required<CashRmgChrome>;
  policy: Required<Pick<CashRmgPolicy, "min_age_years" | "otp_phone_channel">>;
} {
  if (!data?.chrome || !data.policy) return false;
  if (!Number.isFinite(data.policy.min_age_years) || (data.policy.min_age_years ?? 0) < 1)
    return false;
  if (!(data.policy.otp_phone_channel || "").trim()) return false;
  if (
    !Array.isArray(data.policy.allowed_country_codes) ||
    data.policy.allowed_country_codes.length < 1
  ) {
    return false;
  }
  if (!Array.isArray(data.policy.document_kyc_types) || data.policy.document_kyc_types.length < 1) {
    return false;
  }
  if (
    !Array.isArray(data.policy.document_kyc_statuses) ||
    data.policy.document_kyc_statuses.length < 1
  ) {
    return false;
  }
  if (typeof data.policy.require_document_kyc_for_payout !== "boolean") {
    return false;
  }
  if (
    !(data.policy.document_kyc_draft_status || "").trim() ||
    !(data.policy.document_kyc_pending_status || "").trim() ||
    !(data.policy.document_kyc_approved_status || "").trim() ||
    !(data.policy.document_kyc_rejected_status || "").trim() ||
    !(data.policy.document_kyc_passport_type || "").trim()
  ) {
    return false;
  }
  for (const k of CHROME_KEYS) {
    if (!(data.chrome[k] || "").trim()) return false;
  }
  return true;
}

export function docKycTypeLabel(chrome: CashRmgChrome, type: string): string {
  const code = (type || "").trim();
  let labeled = "";
  switch (code) {
    case "passport":
      labeled = (chrome.doc_kyc_type_passport || "").trim();
      break;
    case "national_id":
      labeled = (chrome.doc_kyc_type_national_id || "").trim();
      break;
    case "drivers_license":
      labeled = (chrome.doc_kyc_type_drivers_license || "").trim();
      break;
    default:
      break;
  }
  // Never return blank - empty SelectItem text looks like a broken dropdown.
  return labeled || code;
}
