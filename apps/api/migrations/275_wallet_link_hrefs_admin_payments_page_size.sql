-- Wallet sibling money links from DB (no client invent of /transactions|/receipts).
-- Admin payments console list_page_size from DB (no hardcoded 25).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'link_transactions_href',
  COALESCE(NULLIF(trim(value->>'link_transactions_href'), ''), '/transactions'),
  'link_receipts_href',
  COALESCE(NULLIF(trim(value->>'link_receipts_href'), ''), '/receipts')
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'list_page_size',
    COALESCE(NULLIF(trim(value->'payments'->>'list_page_size'), ''), '25')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
