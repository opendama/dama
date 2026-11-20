-- Trim-style console_nav accordion groups + professional payment receipt chrome.
-- Mirrors Trim admin IA (Overview / Customers / Sales / …) mapped to DAMA domains.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{modules}',
    '[
      {"title":"Overview","href":"/dashboard","body":"Console home and live KPI summary."},
      {"title":"Activity","href":"/activity","body":"Live presence, visits, play volume, and DAU/WAU/MAU by day, week, month, or year."},
      {"title":"Tournaments","href":"/tournaments","body":"Create paid or free (is_free) tournaments with entry fee override."},
      {"title":"Events","href":"/events","body":"Host packages, formats, and join rules for Dama Events."},
      {"title":"Progression","href":"/progression","body":"XP ladder badges and match clock seconds from platform_settings."},
      {"title":"Currency","href":"/payments/currency","body":"Global and Ethiopia settlement currencies."},
      {"title":"Geo routing","href":"/payments/geo","body":"Domestic country and private default city/region."},
      {"title":"Document KYC","href":"/payments/kyc","body":"Government ID review queue for payout eligibility."},
      {"title":"Payouts","href":"/payments/payouts","body":"Approve, reject, and mark cash-out requests paid."},
      {"title":"Receipts","href":"/payments/receipts","body":"Manual transfer proof review with professional receipt detail."},
      {"title":"Transactions","href":"/payments/transactions","body":"Platform-wide top-ups, payouts, and wallet ledger."},
      {"title":"Banks","href":"/banks","body":"Manual transfer bank and mobile-money accounts for checkout."},
      {"title":"Users","href":"/users","body":"Players, publishers, and console roles with audit trail."},
      {"title":"Avatars","href":"/avatars","body":"Moderation queue for player avatar thumb and full assets."},
      {"title":"Ads runtime","href":"/ads","body":"In-match ad interval, non-skippable window, and campaign schedule caps."},
      {"title":"Media pool","href":"/media-pool","body":"Multi-channel upload pool with daily quota failover for ad creatives."},
      {"title":"Feature flags","href":"/feature-flags","body":"Toggle VS-AI practice, OTP gate, and Ethiopian payment mode."},
      {"title":"RBAC","href":"/rbac","body":"Roles catalog and permission grants (database-driven)."},
      {"title":"Telemetry","href":"/telemetry","body":"Fingerprints, GeoIP records, and immutable audit vault."}
    ]'::jsonb
  ),
  '{sections}',
  '[
    {"id":"overview","label":"Overview","items":[
      {"id":"dashboard","label":"Command center","href":"/dashboard"},
      {"id":"activity","label":"Activity","href":"/activity"}
    ]},
    {"id":"competition","label":"Competition","items":[
      {"id":"tournaments","label":"Tournaments","href":"/tournaments"},
      {"id":"events","label":"Events","href":"/events"},
      {"id":"progression","label":"Progression","href":"/progression"}
    ]},
    {"id":"payments","label":"Payments","items":[
      {"id":"pay-currency","label":"Currency","href":"/payments/currency"},
      {"id":"pay-geo","label":"Geo routing","href":"/payments/geo"},
      {"id":"pay-kyc","label":"Document KYC","href":"/payments/kyc"},
      {"id":"pay-payouts","label":"Payouts","href":"/payments/payouts"},
      {"id":"pay-receipts","label":"Receipts","href":"/payments/receipts"},
      {"id":"pay-transactions","label":"Transactions","href":"/payments/transactions"},
      {"id":"banks","label":"Banks","href":"/banks"}
    ]},
    {"id":"players","label":"Players","items":[
      {"id":"users","label":"Users","href":"/users"},
      {"id":"avatars","label":"Avatars","href":"/avatars"}
    ]},
    {"id":"growth","label":"Growth","items":[
      {"id":"ads","label":"Ads runtime","href":"/ads"},
      {"id":"media-pool","label":"Media pool","href":"/media-pool"}
    ]},
    {"id":"access","label":"Access","items":[
      {"id":"feature-flags","label":"Feature flags","href":"/feature-flags"},
      {"id":"rbac","label":"RBAC","href":"/rbac"}
    ]},
    {"id":"platform","label":"Platform","items":[
      {"id":"telemetry","label":"Telemetry","href":"/telemetry"}
    ]}
  ]'::jsonb
),
  updated_at = NOW()
WHERE key = 'console_nav';

-- Professional receipt document chrome (Trim ReceiptView parity for DAMA payment proofs).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_document_title', COALESCE(NULLIF(trim(value->>'receipt_document_title'), ''), 'Payment receipt'),
  'receipt_brand_name', COALESCE(NULLIF(trim(value->>'receipt_brand_name'), ''), 'dama'),
  'receipt_section_bill_to', COALESCE(NULLIF(trim(value->>'receipt_section_bill_to'), ''), 'Bill to'),
  'receipt_section_from', COALESCE(NULLIF(trim(value->>'receipt_section_from'), ''), 'From'),
  'receipt_section_details', COALESCE(NULLIF(trim(value->>'receipt_section_details'), ''), 'Receipt details'),
  'receipt_section_payment', COALESCE(NULLIF(trim(value->>'receipt_section_payment'), ''), 'Payment'),
  'receipt_section_transaction', COALESCE(NULLIF(trim(value->>'receipt_section_transaction'), ''), 'Transaction'),
  'receipt_section_proof', COALESCE(NULLIF(trim(value->>'receipt_section_proof'), ''), 'Transfer proof'),
  'receipt_label_reference', COALESCE(NULLIF(trim(value->>'receipt_label_reference'), ''), 'Reference'),
  'receipt_label_amount', COALESCE(NULLIF(trim(value->>'receipt_label_amount'), ''), 'Amount'),
  'receipt_label_status', COALESCE(NULLIF(trim(value->>'receipt_label_status'), ''), 'Status'),
  'receipt_label_channel', COALESCE(NULLIF(trim(value->>'receipt_label_channel'), ''), 'Channel'),
  'receipt_label_date', COALESCE(NULLIF(trim(value->>'receipt_label_date'), ''), 'Submitted'),
  'receipt_label_id', COALESCE(NULLIF(trim(value->>'receipt_label_id'), ''), 'Receipt ID'),
  'receipt_label_paid_at', COALESCE(NULLIF(trim(value->>'receipt_label_paid_at'), ''), 'Reviewed'),
  'receipt_col_description', COALESCE(NULLIF(trim(value->>'receipt_col_description'), ''), 'Description'),
  'receipt_col_amount', COALESCE(NULLIF(trim(value->>'receipt_col_amount'), ''), 'Amount'),
  'receipt_line_description', COALESCE(NULLIF(trim(value->>'receipt_line_description'), ''), 'Wallet top-up'),
  'receipt_merchant_via', COALESCE(NULLIF(trim(value->>'receipt_merchant_via'), ''), 'Manual bank transfer'),
  'receipt_footer', COALESCE(NULLIF(trim(value->>'receipt_footer'), ''), 'Thank you for playing on dama.'),
  'receipt_print_action', COALESCE(NULLIF(trim(value->>'receipt_print_action'), ''), 'Print'),
  'receipt_print_pending', COALESCE(NULLIF(trim(value->>'receipt_print_pending'), ''), 'Preparing…'),
  'receipt_proof_caption', COALESCE(NULLIF(trim(value->>'receipt_proof_caption'), ''), 'Uploaded transfer proof'),
  'receipt_support_email', COALESCE(
    NULLIF(trim(value->>'receipt_support_email'), ''),
    COALESCE(
      (SELECT NULLIF(trim(both '"' from value::text), '') FROM platform_settings WHERE key = 'support_email' LIMIT 1),
      'support@dama.app'
    )
  )
),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_document_title', COALESCE(NULLIF(trim(value->'payments'->>'receipt_document_title'), ''), 'Payment receipt'),
    'receipt_brand_name', COALESCE(NULLIF(trim(value->'payments'->>'receipt_brand_name'), ''), 'dama'),
    'receipt_section_bill_to', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_bill_to'), ''), 'Bill to'),
    'receipt_section_from', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_from'), ''), 'From'),
    'receipt_section_details', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_details'), ''), 'Receipt details'),
    'receipt_section_payment', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_payment'), ''), 'Payment'),
    'receipt_section_transaction', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_transaction'), ''), 'Transaction'),
    'receipt_section_proof', COALESCE(NULLIF(trim(value->'payments'->>'receipt_section_proof'), ''), 'Transfer proof'),
    'receipt_label_reference', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_reference'), ''), 'Reference'),
    'receipt_label_amount', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_amount'), ''), 'Amount'),
    'receipt_label_status', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_status'), ''), 'Status'),
    'receipt_label_channel', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_channel'), ''), 'Channel'),
    'receipt_label_date', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_date'), ''), 'Submitted'),
    'receipt_label_id', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_id'), ''), 'Receipt ID'),
    'receipt_label_paid_at', COALESCE(NULLIF(trim(value->'payments'->>'receipt_label_paid_at'), ''), 'Reviewed'),
    'receipt_col_description', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_description'), ''), 'Description'),
    'receipt_col_amount', COALESCE(NULLIF(trim(value->'payments'->>'receipt_col_amount'), ''), 'Amount'),
    'receipt_line_description', COALESCE(NULLIF(trim(value->'payments'->>'receipt_line_description'), ''), 'Wallet top-up'),
    'receipt_merchant_via', COALESCE(NULLIF(trim(value->'payments'->>'receipt_merchant_via'), ''), 'Manual bank transfer'),
    'receipt_footer', COALESCE(NULLIF(trim(value->'payments'->>'receipt_footer'), ''), 'Thank you for playing on dama.'),
    'receipt_print_action', COALESCE(NULLIF(trim(value->'payments'->>'receipt_print_action'), ''), 'Print'),
    'receipt_print_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_print_pending'), ''), 'Preparing…'),
    'receipt_proof_caption', COALESCE(NULLIF(trim(value->'payments'->>'receipt_proof_caption'), ''), COALESCE(NULLIF(trim(value->'payments'->>'receipt_proof_label'), ''), 'Transfer proof')),
    'receipt_support_email', COALESCE(NULLIF(trim(value->'payments'->>'receipt_support_email'), ''), 'support@dama.app'),
    'receipt_status_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_pending'), ''), 'Pending'),
    'receipt_status_approved', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_approved'), ''), 'Approved'),
    'receipt_status_rejected', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_rejected'), ''), 'Rejected'),
    'payout_col_when', COALESCE(NULLIF(trim(value->'payments'->>'payout_col_when'), ''), 'Requested'),
    'payout_col_provider', COALESCE(NULLIF(trim(value->'payments'->>'payout_col_provider'), ''), 'Provider'),
    'payout_view_detail', COALESCE(NULLIF(trim(value->'payments'->>'payout_view_detail'), ''), 'View details'),
    'payout_detail_title', COALESCE(NULLIF(trim(value->'payments'->>'payout_detail_title'), ''), 'Payout request'),
    'payout_detail_close', COALESCE(NULLIF(trim(value->'payments'->>'payout_detail_close'), ''), 'Close')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
