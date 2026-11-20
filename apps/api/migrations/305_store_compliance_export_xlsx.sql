-- Account data export is Excel (.xlsx), not JSON.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{export_filename}',
  to_jsonb('dama-account-export.xlsx'::text),
  true
),
updated_at = NOW()
WHERE key = 'store_compliance_chrome'
  AND (
    COALESCE(trim(value->>'export_filename'), '') = ''
    OR lower(trim(value->>'export_filename')) LIKE '%.json'
  );
