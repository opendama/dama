-- Data export download filename from DB (no client invent).
UPDATE platform_settings
SET value = value || '{
  "export_filename": "dama-account-export.json"
}'::jsonb,
updated_at = NOW()
WHERE key = 'store_compliance_chrome';
