-- Trim-style console_nav.sections: Payments accordion with dedicated sub-routes.
-- Keep modules as flat leaf list for Overview KPI + deep links.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{modules}',
    '[
      {"title":"Overview","href":"/dashboard","body":"Console home and live KPI summary."},
      {"title":"Feature flags","href":"/feature-flags","body":"Toggle VS-AI practice, OTP gate, and Ethiopian payment mode."},
      {"title":"Progression","href":"/progression","body":"XP ladder badges and match clock seconds from platform_settings."},
      {"title":"Tournaments","href":"/tournaments","body":"Create paid or free (is_free) tournaments with entry fee override."},
      {"title":"Currency","href":"/payments/currency","body":"Global and Ethiopia settlement currencies."},
      {"title":"Geo routing","href":"/payments/geo","body":"Domestic country and private default city/region."},
      {"title":"Document KYC","href":"/payments/kyc","body":"Government ID review queue for payout eligibility."},
      {"title":"Payouts","href":"/payments/payouts","body":"Approve, reject, and mark cash-out requests paid."},
      {"title":"Receipts","href":"/payments/receipts","body":"Manual transfer proof review with professional receipt detail."},
      {"title":"Transactions","href":"/payments/transactions","body":"Platform-wide top-ups, payouts, and wallet ledger."},
      {"title":"Banks","href":"/banks","body":"Manual transfer bank and mobile-money accounts for checkout."},
      {"title":"Media pool","href":"/media-pool","body":"Multi-channel upload pool with daily quota failover for ad creatives."},
      {"title":"Avatars","href":"/avatars","body":"Moderation queue for player avatar thumb and full assets."},
      {"title":"Users & RBAC","href":"/users","body":"Players, publishers, and console roles with audit trail."},
      {"title":"Telemetry","href":"/telemetry","body":"Fingerprints, GeoIP records, and immutable audit vault."},
      {"title":"RBAC","href":"/rbac","body":"Roles catalog and permission grants (database-driven)."},
      {"title":"Ads runtime","href":"/ads","body":"In-match ad interval, non-skippable window, and campaign schedule caps."},
      {"title":"Activity","href":"/activity","body":"Live presence, visits, play volume, and DAU/WAU/MAU by day, week, month, or year."},
      {"title":"Events","href":"/events","body":"Host packages, formats, and join rules for Dama Events."}
    ]'::jsonb
  ),
  '{sections}',
  '[
    {"id":"overview","label":"Overview","items":[{"id":"dashboard","label":"Overview","href":"/dashboard"}]},
    {"id":"feature-flags","label":"Feature flags","items":[{"id":"feature-flags","label":"Feature flags","href":"/feature-flags"}]},
    {"id":"progression","label":"Progression","items":[{"id":"progression","label":"Progression","href":"/progression"}]},
    {"id":"tournaments","label":"Tournaments","items":[{"id":"tournaments","label":"Tournaments","href":"/tournaments"}]},
    {"id":"payments","label":"Payments","items":[
      {"id":"pay-currency","label":"Currency","href":"/payments/currency"},
      {"id":"pay-geo","label":"Geo routing","href":"/payments/geo"},
      {"id":"pay-kyc","label":"Document KYC","href":"/payments/kyc"},
      {"id":"pay-payouts","label":"Payouts","href":"/payments/payouts"},
      {"id":"pay-receipts","label":"Receipts","href":"/payments/receipts"},
      {"id":"pay-transactions","label":"Transactions","href":"/payments/transactions"},
      {"id":"banks","label":"Banks","href":"/banks"}
    ]},
    {"id":"media-pool","label":"Media pool","items":[{"id":"media-pool","label":"Media pool","href":"/media-pool"}]},
    {"id":"avatars","label":"Avatars","items":[{"id":"avatars","label":"Avatars","href":"/avatars"}]},
    {"id":"users","label":"Users & RBAC","items":[{"id":"users","label":"Users & RBAC","href":"/users"}]},
    {"id":"telemetry","label":"Telemetry","items":[{"id":"telemetry","label":"Telemetry","href":"/telemetry"}]},
    {"id":"rbac","label":"RBAC","items":[{"id":"rbac","label":"RBAC","href":"/rbac"}]},
    {"id":"ads","label":"Ads runtime","items":[{"id":"ads","label":"Ads runtime","href":"/ads"}]},
    {"id":"activity","label":"Activity","items":[{"id":"activity","label":"Activity","href":"/activity"}]},
    {"id":"events","label":"Events","items":[{"id":"events","label":"Events","href":"/events"}]}
  ]'::jsonb
),
  updated_at = NOW()
WHERE key = 'console_nav';

-- Payments console chrome for split pages + transaction/receipt detail tables.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'transactions_section_title', COALESCE(NULLIF(trim(value->'payments'->>'transactions_section_title'), ''), 'Transactions'),
    'transactions_empty', COALESCE(NULLIF(trim(value->'payments'->>'transactions_empty'), ''), 'No transactions yet.'),
    'txn_col_user', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_user'), ''), 'User'),
    'txn_col_kind', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_kind'), ''), 'Kind'),
    'txn_col_amount', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_amount'), ''), 'Amount'),
    'txn_col_status', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_status'), ''), 'Status'),
    'txn_col_reference', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_reference'), ''), 'Reference'),
    'txn_col_provider', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_provider'), ''), 'Channel'),
    'txn_col_when', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_when'), ''), 'When'),
    'txn_col_actions', COALESCE(NULLIF(trim(value->'payments'->>'txn_col_actions'), ''), 'Actions'),
    'txn_view_detail', COALESCE(NULLIF(trim(value->'payments'->>'txn_view_detail'), ''), 'View details'),
    'txn_detail_title', COALESCE(NULLIF(trim(value->'payments'->>'txn_detail_title'), ''), 'Transaction details'),
    'txn_detail_close', COALESCE(NULLIF(trim(value->'payments'->>'txn_detail_close'), ''), 'Close'),
    'receipt_col_user', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_user'), ''), 'User'),
    'receipt_col_amount', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_amount'), ''), 'Amount'),
    'receipt_col_reference', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_reference'), ''), 'Reference'),
    'receipt_col_status', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_status'), ''), 'Status'),
    'receipt_col_when', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_when'), ''), 'Submitted'),
    'receipt_col_actions', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_actions'), ''), 'Actions'),
    'receipt_detail_title', COALESCE(NULLIF(trim(value->'payments'->>'receipt_detail_title'), ''), 'Payment receipt'),
    'receipt_detail_close', COALESCE(NULLIF(trim(value->'payments'->>'receipt_detail_close'), ''), 'Close'),
    'receipt_proof_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_proof_label'), ''), 'Transfer proof'),
    'receipt_provider_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_provider_label'), ''), 'Channel'),
    'search_label', COALESCE(NULLIF(trim(value->'payments'->>'search_label'), ''), 'Search'),
    'search_placeholder', COALESCE(NULLIF(trim(value->'payments'->>'search_placeholder'), ''), 'Search…'),
    'search_debounce_ms', COALESCE(NULLIF(trim(value->'payments'->>'search_debounce_ms'), ''), '250'),
    'actions_label', COALESCE(NULLIF(trim(value->'payments'->>'actions_label'), ''), 'Actions'),
    'doc_kyc_col_user', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_col_user'), ''), 'User'),
    'doc_kyc_col_type', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_col_type'), ''), 'Document'),
    'doc_kyc_col_name', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_col_name'), ''), 'Legal name'),
    'doc_kyc_col_status', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_col_status'), ''), 'Status'),
    'doc_kyc_col_actions', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_col_actions'), ''), 'Actions'),
    'doc_kyc_view_detail', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_view_detail'), ''), 'View details'),
    'doc_kyc_detail_title', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_detail_title'), ''), 'KYC submission'),
    'doc_kyc_detail_close', COALESCE(NULLIF(trim(value->'payments'->>'doc_kyc_detail_close'), ''), 'Close'),
    'currency_page_title', COALESCE(NULLIF(trim(value->'payments'->>'currency_page_title'), ''), 'Currency'),
    'currency_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'currency_page_blurb'), ''), 'Settlement currencies for global and Ethiopia wallets.'),
    'geo_page_title', COALESCE(NULLIF(trim(value->'payments'->>'geo_page_title'), ''), 'Geo routing'),
    'geo_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'geo_page_blurb'), ''), 'Domestic country code and private default city/region.'),
    'kyc_page_title', COALESCE(NULLIF(trim(value->'payments'->>'kyc_page_title'), ''), 'Document KYC'),
    'kyc_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'kyc_page_blurb'), ''), 'Review government ID and selfie submissions for payout eligibility.'),
    'payouts_page_title', COALESCE(NULLIF(trim(value->'payments'->>'payouts_page_title'), ''), 'Payouts'),
    'payouts_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'payouts_page_blurb'), ''), 'Approve, reject, and mark cash-out requests paid.'),
    'receipts_page_title', COALESCE(NULLIF(trim(value->'payments'->>'receipts_page_title'), ''), 'Receipts'),
    'receipts_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'receipts_page_blurb'), ''), 'Review manual transfer proofs and open the full receipt.'),
    'transactions_page_title', COALESCE(NULLIF(trim(value->'payments'->>'transactions_page_title'), ''), 'Transactions'),
    'transactions_page_blurb', COALESCE(NULLIF(trim(value->'payments'->>'transactions_page_blurb'), ''), 'Platform-wide top-ups, payouts, and wallet ledger movements.')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
