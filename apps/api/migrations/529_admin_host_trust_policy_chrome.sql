-- Admin Feature Flags: read-only host-trust policy labels (cash_rmg_policy caps / gates).
-- Console GET /console/cash-rmg/policy returns the live DB values; chrome labels this section.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "host_trust_policy_title": "Host trust policy",
    "host_trust_policy_blurb": "Live cash_rmg_policy values that gate paid organizer cups. Read-only here; change via migrations or DB policy edits.",
    "host_trust_policy_phone_kyc_label": "Paid create requires phone KYC",
    "host_trust_policy_doc_kyc_label": "Guarantee requires document KYC",
    "host_trust_policy_cap_new_host_label": "Concurrent open paid cups (new host)",
    "host_trust_policy_cap_phone_label": "Concurrent open paid cups (phone verified)",
    "host_trust_policy_cap_document_label": "Concurrent open paid cups (document verified)",
    "host_trust_policy_settled_threshold_label": "New-host settled paid threshold",
    "host_trust_policy_rep_open_reports_label": "Reputation max open reports",
    "host_trust_policy_rep_cancel_bps_label": "Reputation cancel rate (bps)",
    "host_trust_policy_rep_cancel_sample_label": "Reputation cancel rate min sample",
    "host_trust_policy_yes": "Yes",
    "host_trust_policy_no": "No"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'feature_flags'->>'host_trust_policy_title', '') = '';
