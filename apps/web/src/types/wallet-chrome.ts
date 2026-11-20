export type WalletChrome = {
  source?: string;
  payout_method_saved?: string;
  payout_request_submitted?: string;
  payout_phone_required?: string;
  payout_method_section?: string;
  payout_request_section?: string;
  payout_phone_label?: string;
  payout_provider_label?: string;
  payout_account_label?: string;
  payout_save_action?: string;
  payout_save_pending?: string;
  payout_request_action?: string;
  payout_request_pending?: string;
  payout_amount_label?: string;
  payout_phone_hint?: string;
  payout_method_save_failed?: string;
  payout_request_failed?: string;
  payout_amount_currency_required?: string;
  wallet_chrome_unavailable?: string;
  sign_in_required?: string;
  sign_in_required_checkout?: string;
  page_title?: string;
  balance_label?: string;
  balance_pending?: string;
  country_code_label?: string;
  country_code_hint?: string;
  top_up_amount_label?: string;
  top_up_amount_placeholder?: string;
  payout_amount_placeholder?: string;
  top_up_action?: string;
  top_up_pending?: string;
  refresh_action?: string;
  refresh_pending?: string;
  detect_location_action?: string;
  detect_location_pending?: string;
  location_unavailable?: string;
  location_geo_failed?: string;
  country_unresolved?: string;
  payment_route_unavailable?: string;
  payment_route_prefix?: string;
  payment_route_separator?: string;
  payout_required_marker?: string;
  wallet_unavailable?: string;
  wallet_load_failed?: string;
  country_required_checkout?: string;
  invalid_top_up_amount?: string;
  checkout_unavailable?: string;
  checkout_ready?: string;
  manual_accounts_title?: string;
  banks_loading?: string;
  banks_empty?: string;
  bank_name_prefix?: string;
  bank_account_prefix?: string;
  bank_mobile_prefix?: string;
  bank_currency_prefix?: string;
  copy_action?: string;
  toast_copied?: string;
  toast_copy_failed?: string;
  bank_copy_account_label?: string;
  bank_copy_mobile_label?: string;
  bank_copy_name_label?: string;
  submit_receipt_title?: string;
  receipt_image_label?: string;
  receipt_uploaded_prefix?: string;
  submit_receipt_action?: string;
  submit_receipt_pending?: string;
  receipt_upload_failed?: string;
  receipt_submitted?: string;
  receipt_submit_failed?: string;
  checkout_failed?: string;
  location_currency_unresolved?: string;
  document_kyc_required?: string;
  paren_open?: string;
  paren_close?: string;
  amount_currency_separator?: string;
  /** Optional list chrome for Transactions / Receipts tables (mig 115). */
  list_search_label?: string;
  list_search_placeholder?: string;
  list_col_date?: string;
  list_col_kind?: string;
  list_col_amount?: string;
  list_col_status?: string;
  list_col_reference?: string;
  list_col_view?: string;
  list_row_actions?: string;
  list_empty_transactions?: string;
  list_empty_receipts?: string;
  list_kind_topup?: string;
  list_kind_payout?: string;
  list_kind_event_host_fee?: string;
  list_kind_event_entry_paid?: string;
  list_kind_event_entry_earned?: string;
  list_kind_event_entry_commission?: string;
  list_kind_event_entry_refund?: string;
  list_kind_event_entry_clawback?: string;
  list_kind_campaign_create_fee?: string;
  list_kind_prize_pool_guarantee_hold?: string;
  list_kind_prize_pool_guarantee_release?: string;
  list_kind_prize_pool_guarantee_capture?: string;
  list_kind_competition_prize_payout?: string;
  list_status_posted?: string;
  list_status_pending?: string;
  list_status_approved?: string;
  list_status_rejected?: string;
  list_status_paid?: string;
  list_status_awaiting_receipt?: string;
  list_status_cancelled?: string;
  /** Transactions row/detail CTA to resume awaiting-proof top-up. */
  list_action_submit_receipt?: string;
  /** Detail hint when transfer proof is still missing. */
  list_awaiting_proof_blurb?: string;
  receipt_intent_unavailable?: string;
  meta_separator?: string;
  err_invalid_json?: string;
  err_unauthorized?: string;
  err_not_found?: string;
  err_tx_ref_required?: string;
  err_invalid_signature?: string;
  list_detail_title?: string;
  receipt_view_detail?: string;
  receipt_reviewed_at_label?: string;
  receipt_intent_id_label?: string;
  receipt_provider_label?: string;
  receipt_proof_label?: string;
  receipt_open_document_action?: string;
  cancel_action?: string;
  dialog_close_label?: string;
  link_transactions_label?: string;
  link_receipts_label?: string;
  /** DB path for transactions deep link (prefix with portal moneyBasePath when set). */
  link_transactions_href?: string;
  /** DB path for receipts deep link (prefix with portal moneyBasePath when set). */
  link_receipts_href?: string;
  /** DB path for wallet deep link (prefix with portal moneyBasePath when set). */
  link_wallet_href?: string;
  /** Domestic manual-transfer page (shown only when payment route is manual_transfer). */
  link_manual_transfer_label?: string;
  link_manual_transfer_href?: string;
  manual_transfer_page_title?: string;
  manual_transfer_page_blurb?: string;
  manual_transfer_unavailable?: string;
  organizer_payout_section_blurb?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  /** Empty cell / missing date or reference (DB only; never invent "-"). */
  empty_value?: string;
  /** Ledger kinds shown muted (informational, e.g. platform commission retained). */
  list_muted_kinds?: string[];
  payout_history_title?: string;
  payout_history_empty?: string;
  payout_history_amount_label?: string;
  payout_history_status_label?: string;
  payout_history_date_label?: string;
  payout_history_note_label?: string;
  payout_history_reviewed_label?: string;
  payout_history_load_failed?: string;
  /** Positive decimal string from DB; never invent client page size. */
  payout_history_page_size?: string;
  payout_methods_empty?: string;
  payout_methods_load_failed?: string;
  payout_method_add_action?: string;
  payout_method_edit_action?: string;
  payout_method_delete_action?: string;
  payout_method_delete_confirm?: string;
  payout_method_deleted?: string;
  payout_method_delete_failed?: string;
  payout_method_updated?: string;
  payout_methods_page_size?: string;
  payout_methods_actions_label?: string;
  age_gate_open_action?: string;
  /** Optional CTA; falls back to cash phone_kyc_title when empty. */
  phone_kyc_open_action?: string;
  /** Trim-parity professional receipt document (mig 310). */
  receipt_document_title?: string;
  receipt_brand_name?: string;
  receipt_section_bill_to?: string;
  receipt_section_from?: string;
  receipt_section_details?: string;
  receipt_section_payment?: string;
  receipt_section_transaction?: string;
  receipt_section_proof?: string;
  receipt_label_reference?: string;
  receipt_label_amount?: string;
  receipt_label_currency?: string;
  receipt_label_status?: string;
  receipt_label_channel?: string;
  receipt_label_date?: string;
  receipt_label_id?: string;
  receipt_label_billing_period?: string;
  receipt_label_paid_at?: string;
  receipt_header_meta_separator?: string;
  receipt_label_subtotal?: string;
  receipt_label_tax?: string;
  receipt_label_total?: string;
  receipt_label_amount_paid?: string;
  receipt_col_description?: string;
  receipt_col_product?: string;
  receipt_col_amount?: string;
  receipt_col_qty?: string;
  receipt_col_unit?: string;
  receipt_col_tax_rate?: string;
  receipt_section_tax_breakdown?: string;
  receipt_label_tax_percent?: string;
  receipt_label_tax_total?: string;
  receipt_tax_rate_display?: string;
  receipt_line_description?: string;
  receipt_merchant_via?: string;
  receipt_footer?: string;
  receipt_print_action?: string;
  receipt_print_pending?: string;
  receipt_download_action?: string;
  receipt_download_pending?: string;
  receipt_download_failed?: string;
  receipt_download_done?: string;
  receipt_download_filename_fmt?: string;
  receipt_brand_mark_alt?: string;
  receipt_proof_caption?: string;
  receipt_support_email?: string;
};

const WALLET_CHROME_KEYS: (keyof WalletChrome)[] = [
  "payout_method_saved",
  "payout_request_submitted",
  "payout_phone_required",
  "payout_method_section",
  "payout_request_section",
  "payout_phone_label",
  "payout_provider_label",
  "payout_account_label",
  "payout_save_action",
  "payout_save_pending",
  "payout_request_action",
  "payout_request_pending",
  "payout_amount_label",
  "payout_phone_hint",
  "payout_method_save_failed",
  "payout_request_failed",
  "payout_amount_currency_required",
  "wallet_chrome_unavailable",
  "sign_in_required",
  "sign_in_required_checkout",
  "page_title",
  "balance_label",
  "balance_pending",
  "country_code_label",
  "country_code_hint",
  "top_up_amount_label",
  "top_up_amount_placeholder",
  "payout_amount_placeholder",
  "top_up_action",
  "top_up_pending",
  "refresh_action",
  "refresh_pending",
  "detect_location_action",
  "detect_location_pending",
  "location_unavailable",
  "location_geo_failed",
  "country_unresolved",
  "payment_route_unavailable",
  "payment_route_prefix",
  "payment_route_separator",
  "payout_required_marker",
  "wallet_unavailable",
  "wallet_load_failed",
  "country_required_checkout",
  "invalid_top_up_amount",
  "checkout_unavailable",
  "checkout_ready",
  "manual_accounts_title",
  "banks_loading",
  "banks_empty",
  "bank_name_prefix",
  "bank_account_prefix",
  "bank_mobile_prefix",
  "bank_currency_prefix",
  "copy_action",
  "toast_copied",
  "toast_copy_failed",
  "bank_copy_account_label",
  "bank_copy_mobile_label",
  "bank_copy_name_label",
  "cancel_action",
  "submit_receipt_title",
  "receipt_image_label",
  "receipt_uploaded_prefix",
  "submit_receipt_action",
  "submit_receipt_pending",
  "receipt_upload_failed",
  "receipt_submitted",
  "receipt_submit_failed",
  "receipt_intent_unavailable",
  "list_action_submit_receipt",
  "list_awaiting_proof_blurb",
  "checkout_failed",
  "location_currency_unresolved",
  "document_kyc_required",
  "paren_open",
  "paren_close",
  "amount_currency_separator",
  "list_kind_topup",
  "list_kind_payout",
  "list_kind_event_host_fee",
  "list_kind_event_entry_paid",
  "list_kind_event_entry_earned",
  "list_kind_event_entry_commission",
  "list_kind_event_entry_refund",
  "list_kind_event_entry_clawback",
  "list_kind_campaign_create_fee",
  "list_kind_prize_pool_guarantee_hold",
  "list_kind_prize_pool_guarantee_release",
  "list_kind_prize_pool_guarantee_capture",
  "list_kind_competition_prize_payout",
  "list_status_posted",
  "list_status_pending",
  "list_status_approved",
  "list_status_rejected",
  "list_status_paid",
  "list_status_awaiting_receipt",
  "list_status_cancelled",
  "meta_separator",
  "err_invalid_json",
  "err_unauthorized",
  "err_not_found",
  "err_tx_ref_required",
  "err_invalid_signature",
  "link_transactions_label",
  "link_receipts_label",
  "link_transactions_href",
  "link_receipts_href",
  "link_wallet_href",
  "link_manual_transfer_label",
  "link_manual_transfer_href",
  "manual_transfer_page_title",
  "manual_transfer_page_blurb",
  "manual_transfer_unavailable",
  "organizer_payout_section_blurb",
  "list_empty_receipts",
  "list_empty_transactions",
  "list_detail_title",
  "dialog_close_label",
  "receipt_view_detail",
  "receipt_reviewed_at_label",
  "receipt_intent_id_label",
  "receipt_provider_label",
  "receipt_proof_label",
  "receipt_open_document_action",
  "list_col_status",
  "list_col_amount",
  "list_col_date",
  "list_col_reference",
  "list_page_size",
  "empty_value",
  "payout_history_title",
  "payout_history_empty",
  "payout_history_amount_label",
  "payout_history_status_label",
  "payout_history_date_label",
  "payout_history_note_label",
  "payout_history_reviewed_label",
  "payout_history_load_failed",
  "payout_history_page_size",
  "payout_methods_empty",
  "payout_methods_load_failed",
  "payout_method_add_action",
  "payout_method_edit_action",
  "payout_method_delete_action",
  "payout_method_delete_confirm",
  "payout_method_deleted",
  "payout_method_delete_failed",
  "payout_method_updated",
  "payout_methods_page_size",
  "payout_methods_actions_label",
  "age_gate_open_action",
  "receipt_document_title",
  "receipt_brand_name",
  "receipt_section_bill_to",
  "receipt_section_from",
  "receipt_section_details",
  "receipt_section_payment",
  "receipt_section_transaction",
  "receipt_section_proof",
  "receipt_label_reference",
  "receipt_label_amount",
  "receipt_label_currency",
  "receipt_label_status",
  "receipt_label_channel",
  "receipt_label_date",
  "receipt_label_id",
  "receipt_label_paid_at",
  "receipt_label_billing_period",
  "receipt_header_meta_separator",
  "receipt_label_subtotal",
  "receipt_label_tax",
  "receipt_label_total",
  "receipt_label_amount_paid",
  "receipt_col_description",
  "receipt_col_product",
  "receipt_col_amount",
  "receipt_col_qty",
  "receipt_col_unit",
  "receipt_col_tax_rate",
  "receipt_section_tax_breakdown",
  "receipt_label_tax_percent",
  "receipt_label_tax_total",
  "receipt_tax_rate_display",
  "receipt_line_description",
  "receipt_merchant_via",
  "receipt_footer",
  "receipt_print_action",
  "receipt_print_pending",
  "receipt_download_action",
  "receipt_download_pending",
  "receipt_download_failed",
  "receipt_download_done",
  "receipt_download_filename_fmt",
  "receipt_brand_mark_alt",
  "receipt_proof_caption",
  "receipt_support_email",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every wallet chrome string must be present from the database. */
export function isWalletChromeReady(
  chrome: WalletChrome | null | undefined,
): chrome is Required<WalletChrome> {
  if (!chrome) return false;
  return WALLET_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
