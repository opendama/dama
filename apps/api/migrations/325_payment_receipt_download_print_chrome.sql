-- Trim-parity receipt Download + Print chrome (wallet + admin payments).
-- Adds first-party PDF download labels; keeps Print labels; brand mark alt for letterhead.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_download_action', COALESCE(NULLIF(trim(value->>'receipt_download_action'), ''), 'Download'),
  'receipt_download_pending', COALESCE(NULLIF(trim(value->>'receipt_download_pending'), ''), 'Downloading…'),
  'receipt_download_failed', COALESCE(NULLIF(trim(value->>'receipt_download_failed'), ''), 'Unable to download receipt'),
  'receipt_download_done', COALESCE(NULLIF(trim(value->>'receipt_download_done'), ''), 'Receipt downloaded'),
  'receipt_download_filename_fmt', COALESCE(NULLIF(trim(value->>'receipt_download_filename_fmt'), ''), 'dama-receipt-{id}.pdf'),
  'receipt_brand_mark_alt', COALESCE(NULLIF(trim(value->>'receipt_brand_mark_alt'), ''), 'Dama'),
  'receipt_print_action', COALESCE(NULLIF(trim(value->>'receipt_print_action'), ''), 'Print'),
  'receipt_print_pending', COALESCE(NULLIF(trim(value->>'receipt_print_pending'), ''), 'Preparing…')
),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_download_action', COALESCE(NULLIF(trim(value->'payments'->>'receipt_download_action'), ''), 'Download'),
    'receipt_download_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_download_pending'), ''), 'Downloading…'),
    'receipt_download_failed', COALESCE(NULLIF(trim(value->'payments'->>'receipt_download_failed'), ''), 'Unable to download receipt'),
    'receipt_download_done', COALESCE(NULLIF(trim(value->'payments'->>'receipt_download_done'), ''), 'Receipt downloaded'),
    'receipt_download_filename_fmt', COALESCE(NULLIF(trim(value->'payments'->>'receipt_download_filename_fmt'), ''), 'dama-receipt-{id}.pdf'),
    'receipt_brand_mark_alt', COALESCE(NULLIF(trim(value->'payments'->>'receipt_brand_mark_alt'), ''), 'Dama'),
    'receipt_print_action', COALESCE(NULLIF(trim(value->'payments'->>'receipt_print_action'), ''), 'Print'),
    'receipt_print_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_print_pending'), ''), 'Preparing…')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
