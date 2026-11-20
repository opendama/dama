-- Trim-parity pending labels for account export + match vote cast CTAs.

UPDATE platform_settings
SET value = value || '{
  "export_data_pending": "Downloading…"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'store_compliance_chrome';

UPDATE platform_settings
SET value = value || '{
  "vote_casting_pending": "Voting…"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
