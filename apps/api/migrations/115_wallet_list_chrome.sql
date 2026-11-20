-- Player Transactions / Receipts list chrome (Trim-style tables).

UPDATE platform_settings
SET value = value || '{
  "list_search_label": "Search",
  "list_search_placeholder": "Search by status, reference, or amount…",
  "list_col_date": "Date",
  "list_col_kind": "Type",
  "list_col_amount": "Amount",
  "list_col_status": "Status",
  "list_col_reference": "Reference",
  "list_col_view": "View",
  "list_row_actions": "Actions",
  "list_empty_transactions": "No transactions yet.",
  "list_empty_receipts": "No receipts yet.",
  "list_kind_topup": "Top-up",
  "list_kind_payout": "Payout",
  "list_detail_title": "Details",
  "cancel_action": "Cancel",
  "dialog_close_label": "Close"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';
