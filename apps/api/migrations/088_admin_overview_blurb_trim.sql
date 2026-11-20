-- Trim-style overview blurb (KPI home; no "Signed in" / module-index language).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard,page_blurb}',
  '"Live console metrics. Every control is database-backed and served to clients."'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'dashboard';
