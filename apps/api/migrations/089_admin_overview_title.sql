-- Overview page title matches Trim/Smart Menu KPI home (nav: Overview).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard,page_title}',
  '"Overview"'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'dashboard';
